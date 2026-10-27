import { parseExportText } from "@jira-dashboard/core/adapter"
import { notifyUnauthorized } from "@/lib/auth/auth-client"
import type { DataSource, FileLike, LoadedData } from "./data-source"

type Options = {
  /** The API root, e.g. "/api" or "https://dashboard.example.com/api". */
  baseUrl: string
  fetch?: typeof globalThis.fetch
}

/**
 * The server's current dataset, behind the `DataSource` interface (api mode).
 * A dropped file is only previewed in this browser; publishing to the server
 * comes with the ingest endpoint (B3).
 */
export function createApiDataSource({ baseUrl, fetch = globalThis.fetch }: Options): DataSource {
  const fromServer = async (): Promise<LoadedData> => {
    let res: Response
    try {
      res = await fetch(`${baseUrl}/dataset`, { credentials: "include", headers: { accept: "application/json" } })
    } catch {
      throw new Error(`Couldn't reach the dashboard server at ${baseUrl}. Is it running?`)
    }
    if (res.status === 401) {
      notifyUnauthorized()
      throw new Error("Your session has ended. Sign in again.")
    }
    if (res.status === 404) throw new Error("The server has no data yet. Send it a Trawler export, or start it with SEED_MOCK=true.")
    if (!res.ok) throw new Error(`The server couldn't send the data (${res.status} ${res.statusText}).`)
    const text = await res.text()
    return {
      dataset: parseExportText(text),
      origin: { kind: "server", ingestId: res.headers.get("x-ingest-id") ?? "unknown" },
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
  }
}
