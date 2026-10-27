/**
 * POST /ingest: the Trawler pushes an export with a bearer token.
 * POST /ingest/upload: an admin publishes a file from the Import page.
 * Both go through the same pipeline; see docs/trawler-integration.md.
 */
import { createHash, timingSafeEqual } from "node:crypto"
// Type-only: brings in the `rateLimit()` decorator typings.
import type {} from "@fastify/rate-limit"
import type { FastifyInstance, FastifyReply } from "fastify"
import { z } from "zod"
import type { Guard } from "../auth/routes"
import type { Env } from "../env"
import { BodyError, bodyToText, tooLarge } from "./body"
import { publicIngest, type IngestPipeline, type IngestResult } from "./pipeline"

/** Pushes allowed per client per minute (the Trawler sends a few a day; this slows token guessing). */
export const INGEST_REQUESTS_PER_MINUTE = 30

const digest = (s: string) => createHash("sha256").update(s).digest()
/** Constant-time: compares fixed-length digests, so neither length nor content leaks through timing. */
const sameToken = (given: string, expected: string) => timingSafeEqual(digest(given), digest(expected))

const uploadBody = z.object({
  fileName: z.string().trim().min(1).max(255),
  text: z.string().min(1, "The file is empty."),
})

type Deps = {
  pipeline: IngestPipeline
  env: Pick<Env, "INGEST_TOKEN" | "INGEST_MAX_MB">
  /** Session and admin checks for the upload route (B2's sessionGuard + requireRole). */
  adminOnly: Guard[]
}

function sendResult(reply: FastifyReply, result: IngestResult) {
  if (result.ok) return reply.code(201).send({ ingest: publicIngest(result.ingest) })
  return reply.code(422).send({ error: "That isn't a valid Jira export; the current data is unchanged.", problems: result.problems })
}

export async function ingestRoutes(api: FastifyInstance, { pipeline, env, adminOnly }: Deps) {
  const maxBytes = Math.floor(env.INGEST_MAX_MB * 1024 * 1024)

  // Push: its own context, so any content type arrives as raw bytes (gzip or not).
  await api.register(async (push) => {
    push.removeAllContentTypeParsers()
    push.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: maxBytes }, (_req, body, done) => done(null, body))
    push.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
      if (err.statusCode === 413) return reply.code(413).send({ error: tooLarge(maxBytes).message })
      if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message })
      throw err
    })

    // Checked before the body is read, so nobody without the token can make the server buffer 50 MB.
    const tokenCheck: Guard = async (request, reply) => {
      if (!env.INGEST_TOKEN) return reply.code(404).send({ error: "Push ingest is off on this server (INGEST_TOKEN isn't set)." })
      const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? "")
      if (!match || !sameToken(match[1].trim(), env.INGEST_TOKEN)) {
        return reply.code(401).header("WWW-Authenticate", 'Bearer realm="ingest"').send({ error: "Missing or wrong ingest token." })
      }
    }

    // The limiter goes first, so attempts with a wrong token count too.
    const limit = push.rateLimit({ max: INGEST_REQUESTS_PER_MINUTE, timeWindow: "1 minute" })
    push.post(
      "/ingest",
      { onRequest: [limit, tokenCheck] },
      async (request, reply) => {
        const body = request.body
        if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: "Send the export as the request body." })
        let text: string
        try {
          text = await bodyToText(body, maxBytes, request.headers["content-encoding"])
        } catch (err) {
          if (err instanceof BodyError) return reply.code(err.status).send({ error: err.message })
          throw err
        }
        return sendResult(reply, await pipeline.ingest(text, { source: "push" }))
      },
    )
  })

  // Publish from the Import page: a signed-in admin, JSON body only (see decision 0032 on CSRF).
  api.post("/ingest/upload", { onRequest: adminOnly, bodyLimit: maxBytes + 64 * 1024 }, async (request, reply) => {
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return reply.code(415).send({ error: "Send JSON: { fileName, text }." })
    }
    const body = uploadBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Send { fileName, text }." })
    if (Buffer.byteLength(body.data.text, "utf8") > maxBytes) return reply.code(413).send({ error: tooLarge(maxBytes).message })
    const result = await pipeline.ingest(body.data.text, { source: "upload", uploadedBy: request.auth!.user.id, fileName: body.data.fileName })
    return sendResult(reply, result)
  })
}
