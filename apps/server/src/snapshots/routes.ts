/**
 * Snapshot history for the web app, and an admin trigger for the job.
 * GET /snapshots?teamId=&from=&to=, GET /snapshots/:teamId/:date,
 * POST /jobs/snapshot.
 */
import { parseDay } from "@jira-dashboard/core/snapshot"
import { differenceInCalendarDays } from "date-fns"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import type { Guard } from "../auth/routes"
import type { Env } from "../env"
import { NoDataError, previousDay, type SnapshotJob } from "./job"
import type { SnapshotStore } from "./store"

/** The longest range one list request may ask for. */
export const MAX_RANGE_DAYS = 400

const day = z.string().refine((d) => {
  try {
    parseDay(d)
    return true
  } catch {
    return false
  }
}, "must be a date (yyyy-MM-dd)")
const listQuery = z.object({ teamId: z.string().trim().min(1), from: day, to: day })
const runBody = z.object({ date: day.optional() }).strict()

type Deps = {
  store: SnapshotStore
  job: SnapshotJob
  env: Pick<Env, "SNAPSHOT_TZ">
  signedIn: Guard
  adminOnly: Guard[]
  now?: () => Date
}

export async function snapshotRoutes(api: FastifyInstance, { store, job, env, signedIn, adminOnly, now = () => new Date() }: Deps) {
  api.get("/snapshots", { preHandler: signedIn }, async (request, reply) => {
    const query = listQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: "Give teamId, from and to (yyyy-MM-dd)." })
    const { teamId, from, to } = query.data
    const span = differenceInCalendarDays(parseDay(to), parseDay(from))
    if (span < 0) return reply.code(400).send({ error: "from must be on or before to." })
    if (span >= MAX_RANGE_DAYS) return reply.code(400).send({ error: `Ask for at most ${MAX_RANGE_DAYS} days at a time.` })
    return { snapshots: await store.list(teamId, from, to) }
  })

  api.get<{ Params: { teamId: string; date: string } }>("/snapshots/:teamId/:date", { preHandler: signedIn }, async (request, reply) => {
    const { teamId, date } = request.params
    if (!day.safeParse(date).success) return reply.code(400).send({ error: "The date must be yyyy-MM-dd." })
    const snapshot = await store.get(teamId, date)
    return snapshot ?? reply.code(404).send({ error: `No snapshot for ${teamId} on ${date}.` })
  })

  // Admins: snapshot a day now (default yesterday). JSON body only, like other writes (decision 0032).
  api.post("/jobs/snapshot", { onRequest: adminOnly }, async (request, reply) => {
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return reply.code(415).send({ error: "Send JSON: {} or { date }." })
    }
    const body = runBody.safeParse(request.body ?? {})
    if (!body.success) return reply.code(400).send({ error: "Send {} or { date: yyyy-MM-dd }." })
    const date = body.data.date ?? previousDay(now(), env.SNAPSHOT_TZ)
    try {
      const [result] = await job.run([date])
      if ("error" in result) return reply.code(422).send({ error: result.error })
      return result
    } catch (err) {
      if (err instanceof NoDataError) return reply.code(409).send({ error: err.message })
      throw err
    }
  })
}
