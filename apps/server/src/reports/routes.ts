/**
 * Server-side reports (B5): created by authors, shared with people and
 * groups, access checked on every request. docs/decisions/0040–0042.
 */
import { parseReportConfig, type ReportConfig } from "@jira-dashboard/core/report-config"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import type { Guard } from "../auth/routes"
import type { DatasetStore } from "../dataset-store"
import type { ReportDoc } from "../db"
import { canRead, isOwner, isUnread, type Reader } from "./access"
import type { ReportStore } from "./store"

const recipientsSchema = z.object({
  users: z.array(z.object({ id: z.string().trim().min(1).max(200), displayName: z.string().trim().min(1).max(200) })).max(200).default([]),
  groups: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
})
type Recipients = z.output<typeof recipientsSchema>
const createBody = z.object({ config: z.unknown(), recipients: recipientsSchema.optional() })
const patchBody = z.object({ config: z.unknown().optional(), recipients: recipientsSchema.optional() })

type Deps = {
  store: ReportStore
  datasets: DatasetStore
  signedIn: Guard
  /** Creating needs the author role. */
  authorOnly: Guard[]
  /** A person's groups (from the users cache, kept fresh by sign-in and revalidation). */
  groupsOf: (userId: string) => Promise<string[]>
  displayNameOf: (userId: string) => Promise<string>
  now?: () => Date
}

/** A request the rules refuse; `status` is the HTTP answer. */
class Refusal extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const jsonOnly = (request: FastifyRequest) => {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) throw new Refusal(415, "Send JSON.")
}

/** Recipients without the owner, and without duplicates. */
function cleanRecipients({ users, groups }: Recipients, ownerId: string): ReportDoc["recipients"] {
  const seen = new Set<string>()
  return {
    users: users.filter((u) => u.id !== ownerId && !seen.has(u.id) && seen.add(u.id)),
    groups: [...new Set(groups)],
  }
}

export async function reportRoutes(api: FastifyInstance, deps: Deps) {
  const { store, datasets, signedIn, authorOnly, groupsOf, displayNameOf, now = () => new Date() } = deps

  const readerOf = async (request: FastifyRequest): Promise<Reader> => {
    const id = request.auth!.user.id
    return { id, groups: await groupsOf(id) }
  }

  /** The report, if this person may open it; otherwise 404 (no such report) or 403 (not shared with them). */
  const readable = async (id: string, reader: Reader) => {
    const doc = await store.get(id)
    if (!doc) throw new Refusal(404, "There's no such report.")
    if (!canRead(doc, reader)) throw new Refusal(403, "You don't have access to this report. Ask its owner to share it with you.")
    return doc
  }

  const owned = async (id: string, reader: Reader) => {
    const doc = await readable(id, reader)
    if (!isOwner(doc, reader)) throw new Refusal(403, "Only the report's owner can change it.")
    return doc
  }

  /** Frozen reports show the data they were made from: the server's current data, at the moment of freezing. */
  const freezeAgainstCurrent = async (config: ReportConfig) => {
    const current = await datasets.meta()
    if (!current || current.generatedAt?.toISOString() !== config.dataStamp) {
      throw new Refusal(409, "A frozen report must be made from the server's current data. Go back to the server's data and save it again.")
    }
    return { ingestId: current.id }
  }

  const view = async (doc: ReportDoc, reader: Reader, lastRead?: Date) => ({
    id: doc._id,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    config: doc.config,
    owner: { id: doc.ownerId, displayName: await displayNameOf(doc.ownerId) },
    recipients: doc.recipients,
    frozen: Boolean(doc.frozen),
    frozenIngestId: doc.frozen?.ingestId ?? null,
    unread: isUnread(doc, reader, lastRead),
    canEdit: isOwner(doc, reader),
  })

  const handle =
    <R>(fn: (request: FastifyRequest, reply: FastifyReply) => Promise<R>) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return await fn(request, reply)
      } catch (err) {
        if (err instanceof Refusal) return reply.code(err.status).send({ error: err.message })
        throw err
      }
    }

  api.get(
    "/reports",
    { preHandler: signedIn },
    handle(async (request) => {
      const box = (request.query as { box?: string }).box === "shared" ? "shared" : "mine"
      const reader = await readerOf(request)
      const docs = box === "mine" ? await store.listOwned(reader.id) : await store.listSharedWith(reader.id, reader.groups)
      const reads = await store.lastReads(reader.id, docs.map((d) => d._id))
      return { reports: await Promise.all(docs.map((d) => view(d, reader, reads.get(d._id)))) }
    }),
  )

  api.get(
    "/reports/:id",
    { preHandler: signedIn },
    handle(async (request) => {
      const reader = await readerOf(request)
      const doc = await readable((request.params as { id: string }).id, reader)
      // Opening a report shared with you marks it read.
      const at = now()
      if (!isOwner(doc, reader)) await store.markRead(doc._id, reader.id, at)
      return view(doc, reader, at)
    }),
  )

  api.get(
    "/reports/:id/data",
    { preHandler: signedIn },
    handle(async (request, reply) => {
      const doc = await readable((request.params as { id: string }).id, await readerOf(request))
      if (!doc.frozen) throw new Refusal(404, "Only frozen reports keep their own data; this one shows the current data.")
      const data = await datasets.byIngest(doc.frozen.ingestId)
      if (!data) throw new Refusal(410, "This frozen report's data is no longer on the server.")
      reply.header("X-Ingest-Id", data.ingest.id).header("X-Ingest-Source", data.ingest.source).header("Cache-Control", "private, no-cache")
      return reply.type("application/json; charset=utf-8").send(data.json)
    }),
  )

  api.post(
    "/reports",
    { onRequest: authorOnly },
    handle(async (request, reply) => {
      jsonOnly(request)
      const body = createBody.safeParse(request.body)
      const config = body.success ? parseReportConfig(body.data.config) : null
      if (!body.success || !config) throw new Refusal(400, "That isn't a valid report.")
      const reader = await readerOf(request)
      const doc = await store.create(
        {
          ownerId: reader.id,
          config,
          recipients: cleanRecipients(body.data.recipients ?? { users: [], groups: [] }, reader.id),
          frozen: config.kind === "frozen" ? await freezeAgainstCurrent(config) : undefined,
        },
        now(),
      )
      return reply.code(201).send(await view(doc, reader))
    }),
  )

  api.patch(
    "/reports/:id",
    { preHandler: signedIn },
    handle(async (request) => {
      jsonOnly(request)
      const body = patchBody.safeParse(request.body)
      if (!body.success || (body.data.config === undefined && body.data.recipients === undefined)) {
        throw new Refusal(400, "Send a new config, new recipients, or both.")
      }
      const reader = await readerOf(request)
      const doc = await owned((request.params as { id: string }).id, reader)
      let frozen: ReportDoc["frozen"] | null | undefined
      let config: ReportConfig | undefined
      if (body.data.config !== undefined) {
        config = parseReportConfig(body.data.config) ?? undefined
        if (!config) throw new Refusal(400, "That isn't a valid report.")
        // Keep the pinned data while the report still refers to it; otherwise freeze anew (or unfreeze).
        if (config.kind === "live") frozen = null
        else if (!doc.frozen || doc.config.dataStamp !== config.dataStamp) frozen = await freezeAgainstCurrent(config)
      }
      const next = await store.update(
        doc._id,
        {
          ...(config ? { config } : {}),
          ...(body.data.recipients ? { recipients: cleanRecipients(body.data.recipients, doc.ownerId) } : {}),
          ...(frozen !== undefined ? { frozen } : {}),
        },
        now(),
      )
      return view(next!, reader)
    }),
  )

  api.delete(
    "/reports/:id",
    { preHandler: signedIn },
    handle(async (request, reply) => {
      const doc = await owned((request.params as { id: string }).id, await readerOf(request))
      await store.delete(doc._id)
      return reply.code(204).send()
    }),
  )
}
