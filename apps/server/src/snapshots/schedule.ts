import { Cron } from "croner"
import type { FastifyBaseLogger } from "fastify"
import type { Env } from "../env"
import { NoDataError, previousDay, type SnapshotJob } from "./job"

/** Snapshot yesterday on SNAPSHOT_CRON in SNAPSHOT_TZ (never overlapping). Null when the schedule is "off". */
export function scheduleSnapshots(env: Pick<Env, "SNAPSHOT_CRON" | "SNAPSHOT_TZ">, job: SnapshotJob, log: Pick<FastifyBaseLogger, "warn" | "error">) {
  if (env.SNAPSHOT_CRON === "off") return null
  return new Cron(env.SNAPSHOT_CRON, { timezone: env.SNAPSHOT_TZ, protect: true, name: "daily-snapshot" }, async () => {
    const day = previousDay(new Date(), env.SNAPSHOT_TZ)
    try {
      const [result] = await job.run([day])
      if ("error" in result) log.warn({ day, error: result.error }, "snapshot skipped")
    } catch (err) {
      if (err instanceof NoDataError) log.warn({ day }, err.message)
      else log.error({ err, day }, "snapshot failed")
    }
  })
}
