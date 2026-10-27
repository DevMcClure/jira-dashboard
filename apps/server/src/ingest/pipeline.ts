/**
 * The one way data becomes current: Trawler pushes, scheduled pulls and
 * published uploads all come through here, validated by `core`'s adapter, the
 * same code as the Import page. A rejected input is recorded and the current
 * dataset is left alone.
 */
import { createHash } from "node:crypto"
import { JiraExportError, parseExportText } from "@jira-dashboard/core/adapter"
import type { FastifyBaseLogger } from "fastify"
import type { IngestSource } from "../db"
import type { DatasetStore, Ingest } from "../dataset-store"

/** How many stored dataset texts to keep (the current one included); older ingests keep only their record. */
export const KEEP_DATASETS = 10
const MAX_PROBLEMS = 50

export type IngestResult =
  | { ok: true; ingest: Ingest; unchanged: boolean }
  | { ok: false; ingest: Ingest; problems: string[] }

type Options = {
  source: Exclude<IngestSource, "seed">
  uploadedBy?: string
  fileName?: string
  /** Skip the ingest when the text is identical to the current dataset's (pull). */
  onlyIfChanged?: boolean
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/** Validate an export's text and describe it for the `ingests` record. Throws JiraExportError / SyntaxError. */
export function describeExport(text: string) {
  const dataset = parseExportText(text)
  return {
    generatedAt: dataset.meta.generatedAt,
    counts: { teams: dataset.teams.length, people: dataset.people.length, sprints: dataset.sprints.length, issues: dataset.issues.length },
    sha256: sha256(text),
    bytes: Buffer.byteLength(text, "utf8"),
  }
}

/** Validation problems as readable lines; anything else is a server fault and is rethrown. */
function problemsFrom(err: unknown): string[] {
  if (err instanceof JiraExportError) return err.problems.slice(0, MAX_PROBLEMS)
  if (err instanceof SyntaxError) return [`Not valid JSON: ${err.message}`]
  throw err
}

type Deps = {
  store: DatasetStore
  log: Pick<FastifyBaseLogger, "info" | "warn" | "error">
  keep?: number
}

export function createIngestPipeline({ store, log, keep = KEEP_DATASETS }: Deps) {
  // One at a time, so two ingests can't race for "current".
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => {})
    return run
  }

  return {
    ingest(text: string, { source, uploadedBy, fileName, onlyIfChanged = false }: Options): Promise<IngestResult> {
      return serial(async () => {
        const recorded = { source, uploadedBy, fileName, sha256: sha256(text), bytes: Buffer.byteLength(text, "utf8") }
        if (onlyIfChanged) {
          const current = await store.meta()
          if (current?.sha256 === recorded.sha256) return { ok: true, ingest: current, unchanged: true }
        }

        let described: ReturnType<typeof describeExport>
        try {
          described = describeExport(text)
        } catch (err) {
          const problems = problemsFrom(err)
          const ingest = await store.recordRejected({ ...recorded, errors: problems })
          log.warn({ ingestId: ingest.id, source, bytes: recorded.bytes, problems: problems.length, first: problems[0] }, "ingest rejected")
          return { ok: false, ingest, problems }
        }

        const ingest = await store.insertCurrent({ ...recorded, json: text, generatedAt: described.generatedAt, counts: described.counts })
        log.info({ ingestId: ingest.id, source, bytes: recorded.bytes, ...described.counts }, "ingest is now current")
        try {
          await store.prune(keep)
        } catch (err) {
          // The new data is live; old texts are tidied up after the next ingest instead.
          log.error({ err }, "couldn't remove old dataset texts")
        }
        return { ok: true, ingest, unchanged: false }
      })
    },
  }
}

export type IngestPipeline = ReturnType<typeof createIngestPipeline>

/** What an ingest response says about the new data (no internals such as hashes or uploader). */
export const publicIngest = (i: Ingest) => ({ id: i.id, receivedAt: i.receivedAt, generatedAt: i.generatedAt, source: i.source, counts: i.counts })
