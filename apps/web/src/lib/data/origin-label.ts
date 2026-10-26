import type { DataOrigin } from "./data-source"

/** How to name the loaded data: a short form for the sidebar, a long one for summaries, and a download filename. */
export function originLabel(origin: DataOrigin) {
  switch (origin.kind) {
    case "sample":
      return { short: "sample", long: "Bundled sample data", fileName: "jira-export.sample.json" }
    case "upload":
      return { short: origin.fileName, long: origin.fileName, fileName: origin.fileName }
    case "server":
      return { short: "server", long: "Server (current dataset)", fileName: "jira-export.server.json" }
  }
}
