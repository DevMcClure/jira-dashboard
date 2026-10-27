/**
 * Rebuild past days' snapshots from the changelog of the server's current
 * data: `pnpm snapshot:backfill --from 2026-08-31 --to 2026-10-25 [--force]`
 * (or `node apps/server/dist/backfill.js …` in a build). Snapshots taken on
 * the day are kept unless --force. Uses the same .env as the server.
 */
import { parseArgs } from "node:util"
import { connect, ensureIndexes } from "../db"
import { createMongoDatasetStore } from "../dataset-store"
import { EnvError, loadEnv } from "../env"
import { createMongoSettingsStore } from "../settings/store"
import { createSnapshotJob, daysBetween, NoDataError } from "./job"
import { createMongoSnapshotStore } from "./store"

const usage = "Usage: pnpm snapshot:backfill --from yyyy-MM-dd --to yyyy-MM-dd [--force]"

async function main() {
  const { values } = parseArgs({ options: { from: { type: "string" }, to: { type: "string" }, force: { type: "boolean", default: false } } })
  if (!values.from || !values.to) {
    console.error(usage)
    return 2
  }
  let days: string[]
  try {
    days = daysBetween(values.from, values.to)
  } catch (err) {
    console.error(`${(err as Error).message}\n${usage}`)
    return 2
  }
  if (!days.length) {
    console.error("--from must be on or before --to.")
    return 2
  }

  let env
  try {
    env = loadEnv(process.env)
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(err.message)
      return 1
    }
    throw err
  }
  // Days start and end in the teams' time zone, as on the server.
  process.env.TZ = env.SNAPSHOT_TZ

  const mongo = await connect(env)
  try {
    await ensureIndexes(mongo.db)
    const job = createSnapshotJob({
      datasets: createMongoDatasetStore(mongo.db),
      snapshots: createMongoSnapshotStore(mongo.db),
      log: { info: () => {}, warn: () => {} },
      // The same flow settings the server uses.
      flowConfig: async () => (await createMongoSettingsStore(mongo.db).getFlow())?.config,
    })
    const results = await job.run(days, { backfilled: true, force: values.force })
    const tally = { written: 0, unchanged: 0, kept: 0, skipped: 0 }
    for (const r of results) {
      if ("error" in r) {
        tally.skipped++
        console.log(`${r.date}  skipped: ${r.error}`)
        continue
      }
      const counts = { written: 0, unchanged: 0, kept: 0 }
      for (const t of r.teams) counts[t.result]++
      tally.written += counts.written
      tally.unchanged += counts.unchanged
      tally.kept += counts.kept
      const parts = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`)
      console.log(`${r.date}  ${parts.join(", ")}${counts.kept ? " (taken on the day; --force replaces them)" : ""}${r.stale ? "  [stale]" : ""}`)
    }
    const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`
    console.log(`\n${n(days.length, "day")}: ${tally.written} written, ${tally.unchanged} unchanged, ${tally.kept} kept, ${n(tally.skipped, "day")} skipped.`)
    return 0
  } catch (err) {
    if (err instanceof NoDataError) {
      console.error(err.message)
      return 1
    }
    throw err
  } finally {
    await mongo.client.close()
  }
}

process.exit(await main())
