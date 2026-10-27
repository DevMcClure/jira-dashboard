/**
 * Where the dashboard's data comes from. `DataProvider` only talks to this
 * interface, so a server-backed source (live Trawler feed) can replace the
 * static one without any page changing. See docs/decisions/0003.
 */
import type { JiraDataset } from "@jira-dashboard/core/types"

/** How the server's current dataset arrived (api mode): seeded mock data, a Trawler push or pull, or a file an admin published. */
export type ServerSource = "seed" | "push" | "pull" | "upload"

/** What the loaded data is: the bundled sample, a file the user uploaded, or the server's current dataset (api mode). */
export type DataOrigin =
  | { kind: "sample" }
  | { kind: "upload"; fileName: string; loadedAt: string }
  | { kind: "server"; ingestId: string; source: ServerSource | null }

export type LoadedData = {
  dataset: JiraDataset
  origin: DataOrigin
  /** The raw text as loaded (for "Download current data"). */
  rawJson: string
}

/** The parts of a `File` a source needs (so tests don't need a DOM). */
export type FileLike = Pick<File, "name" | "text">

export interface DataSource {
  /** Initial data: the remembered upload if it's still valid, else the sample. */
  load(): Promise<LoadedData>
  /**
   * Parse a user's file and make it the current data. Rejects with
   * `JiraExportError` / `SyntaxError` on bad input, leaving any remembered data alone.
   * `remembered` is false when it couldn't be kept for the next visit (e.g. too large).
   */
  loadFile(file: FileLike): Promise<{ data: LoadedData; remembered: boolean }>
  /** Forget any upload and return the sample (api mode: the server's current data). */
  reset(): Promise<LoadedData>
  /** api mode: the server's current ingest id, polled to notice new data (null if it has none or can't say). */
  latestVersion?(): Promise<string | null>
  /**
   * api mode, admins: make a file the server's current data for everyone, then return it.
   * Rejects with `JiraExportError` (the server's problems) when the file isn't valid.
   */
  publishFile?(file: FileLike): Promise<LoadedData>
}
