/**
 * Optional pull, for when the Trawler can't call out: on TRAWLER_PULL_CRON
 * (and once at startup), fetch TRAWLER_PULL_URL or read TRAWLER_PULL_PATH and
 * send it through the pipeline. An unchanged file is skipped.
 */
import { readFile, stat } from "node:fs/promises"
import { Cron } from "croner"
import type { FastifyBaseLogger } from "fastify"
import type { Env } from "../env"
import { BodyError, bodyToText, tooLarge } from "./body"
import type { IngestPipeline } from "./pipeline"

export type PullOutcome =
  | { status: "ingested" | "unchanged"; ingestId: string }
  | { status: "rejected"; ingestId: string; problems: string[] }
  | { status: "failed"; error: string }

type Deps = {
  pipeline: IngestPipeline
  env: Pick<Env, "TRAWLER_PULL_URL" | "TRAWLER_PULL_PATH" | "INGEST_MAX_MB">
  log: Pick<FastifyBaseLogger, "info" | "warn">
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

/** Where pulls come from, safe to log (a URL's host and path only, never credentials or query). */
export function pullSourceLabel(env: Pick<Env, "TRAWLER_PULL_URL" | "TRAWLER_PULL_PATH">) {
  if (env.TRAWLER_PULL_PATH) return env.TRAWLER_PULL_PATH
  if (!env.TRAWLER_PULL_URL) return null
  const url = new URL(env.TRAWLER_PULL_URL)
  return `${url.protocol}//${url.host}${url.pathname}`
}

export function createPuller({ pipeline, env, log, fetch = globalThis.fetch, timeoutMs = 60_000 }: Deps) {
  const maxBytes = Math.floor(env.INGEST_MAX_MB * 1024 * 1024)
  const where = pullSourceLabel(env)

  const fromUrl = async (url: string) => {
    const res = await fetch(url, { headers: { accept: "application/json, application/gzip, */*" }, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) throw new BodyError(res.status, `answered ${res.status} ${res.statusText}`.trim())
    if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw tooLarge(maxBytes)
    // Read with a cap rather than trusting Content-Length. (fetch already undoes Content-Encoding.)
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of res.body ?? []) {
      size += chunk.length
      if (size > maxBytes) throw tooLarge(maxBytes)
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  const fromPath = async (path: string) => {
    if ((await stat(path)).size > maxBytes) throw tooLarge(maxBytes)
    return readFile(path)
  }

  return {
    async run(): Promise<PullOutcome> {
      let text: string
      try {
        const body = env.TRAWLER_PULL_PATH ? await fromPath(env.TRAWLER_PULL_PATH) : await fromUrl(env.TRAWLER_PULL_URL!)
        text = await bodyToText(body, maxBytes)
      } catch (err) {
        // fetch's own message is just "fetch failed"; the cause says why (ECONNREFUSED, ENOTFOUND, …).
        const cause = (err as { cause?: { code?: string; message?: string } }).cause
        const message = err instanceof Error ? err.message : String(err)
        const error = cause ? `${message} (${cause.code ?? cause.message})` : message
        log.warn({ from: where, error }, "pull failed; the current data is unchanged")
        return { status: "failed", error }
      }
      const result = await pipeline.ingest(text, { source: "pull", onlyIfChanged: true })
      if (!result.ok) return { status: "rejected", ingestId: result.ingest.id, problems: result.problems }
      if (result.unchanged) log.info({ from: where }, "pull: unchanged since the last ingest")
      return { status: result.unchanged ? "unchanged" : "ingested", ingestId: result.ingest.id }
    },
  }
}

/** Runs `run` on the cron (never overlapping) and once now. Returns the job so the server can stop it. */
export function schedulePull(cron: string, run: () => Promise<unknown>) {
  const job = new Cron(cron, { protect: true, name: "trawler-pull" }, async () => {
    await run()
  })
  void run()
  return job
}
