import { JiraExportError, parseExportText } from "@jira-dashboard/core/adapter"
import { notifyUnauthorized } from "@/lib/auth/auth-client"
import type { DataSource, FileLike, LoadedData, ServerSource } from "./data-source"

type Options = {
  /** The API root, e.g. "/api" or "https://dashboard.example.com/api". */
  baseUrl: string
  fetch?: typeof globalThis.fetch
}

const SERVER_SOURCES: readonly string[] = ["seed", "push", "pull", "upload"] satisfies ServerSource[]
const SESSION_ENDED = "Your session has ended. Sign in again."

/**
 * The server's current dataset, behind the `DataSource` interface (api mode).
 * A dropped file is previewed in this browser; admins can then publish it
 * to the server (POST /ingest/upload), the same pipeline the Trawler uses.
 */
export function createApiDataSource({ baseUrl, fetch = globalThis.fetch }: Options): DataSource {
  const call = async (path: string, init: RequestInit = {}) => {
    try {
      return await fetch(`${baseUrl}${path}`, { ...init, credentials: "include", headers: { accept: "application/json", ...init.headers } })
    } catch {
      throw new Error(`Couldn't reach the dashboard server at ${baseUrl}. Is it running?`)
    }
  }

  const fromServer = async (): Promise<LoadedData> => {
    const res = await call("/dataset")
    if (res.status === 401) {
      notifyUnauthorized()
      throw new Error(SESSION_ENDED)
    }
    if (res.status === 404) throw new Error("The server has no data yet. Send it a Trawler export, or start it with SEED_MOCK=true.")
    if (!res.ok) throw new Error(`The server couldn't send the data (${res.status} ${res.statusText}).`)
    const text = await res.text()
    const source = res.headers.get("x-ingest-source")
    return {
      dataset: parseExportText(text),
      origin: {
        kind: "server",
        ingestId: res.headers.get("x-ingest-id") ?? "unknown",
        source: source && SERVER_SOURCES.includes(source) ? (source as ServerSource) : null,
      },
      rawJson: text,
    }
  }

  return {
    load: fromServer,

    async loadFile(file: FileLike) {
      const text = await file.text()
      const dataset = parseExportText(text)
      return {
        data: { dataset, origin: { kind: "upload", fileName: file.name, loadedAt: new Date().toISOString() }, rawJson: text },
        remembered: false,
      }
    },

    reset: fromServer,

    async latestVersion() {
      const res = await call("/dataset/meta", { cache: "no-store" })
      if (res.status === 401) {
        notifyUnauthorized()
        return null
      }
      if (!res.ok) return null
      const meta = (await res.json()) as { ingestId?: string }
      return meta.ingestId ?? null
    },

    async publishFile(file: FileLike) {
      const res = await call("/ingest/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, text: await file.text() }),
      })
      if (res.status === 401) {
        notifyUnauthorized()
        throw new Error(SESSION_ENDED)
      }
      const body = (await res.json().catch(() => null)) as { error?: string; problems?: string[] } | null
      if (res.status === 422) throw new JiraExportError(body?.problems?.length ? body.problems : ["The server says this isn't a valid export."])
      if (res.status === 413) throw new Error("The file is larger than the server accepts (INGEST_MAX_MB).")
      if (!res.ok) throw new Error(body?.error ?? `The server couldn't publish the file (${res.status}).`)
      return fromServer()
    },
  }
}
