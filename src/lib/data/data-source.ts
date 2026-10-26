/**
 * Where the dashboard's data comes from. `DataProvider` only talks to this
 * interface, so a server-backed source (live Trawler feed) can replace the
 * static one without any page changing. See docs/decisions/0003.
 */
import type { JiraDataset } from "@/lib/jira/types"

/** What the loaded data is: the bundled sample, or a file the user uploaded. */
export type DataOrigin =
  | { kind: "sample" }
  | { kind: "upload"; fileName: string; loadedAt: string }

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
  /** Forget any upload and return the sample. */
  reset(): Promise<LoadedData>
}
