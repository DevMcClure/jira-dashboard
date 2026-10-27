import { format, isSameDay } from "date-fns"
import type { DataOrigin } from "./data-source"

/** How to name the loaded data: a short form for the sidebar, a long one for summaries, and a download filename. */
export function originLabel(origin: DataOrigin) {
  switch (origin.kind) {
    case "sample":
      return { short: "sample", long: "Bundled sample data", fileName: "jira-export.sample.json" }
    case "upload":
      return { short: origin.fileName, long: origin.fileName, fileName: origin.fileName }
    case "server": {
      const fileName = "jira-export.server.json"
      switch (origin.source) {
        case "push":
        case "pull":
          return { short: "live", long: `Server: live Trawler feed (${origin.source})`, fileName }
        case "seed":
          return { short: "server (sample)", long: "Server: the mock data it was seeded with", fileName }
        case "upload":
          return { short: "server (published file)", long: "Server: a file an admin published", fileName }
        default:
          return { short: "server", long: "Server (current dataset)", fileName }
      }
    }
  }
}

/**
 * The sidebar's data line. A live feed shows when it was trawled ("Data: live ·
 * trawled 08:15", or with the date when it wasn't today); everything else shows
 * the export's generation date.
 */
export function dataLineLabel(origin: DataOrigin, generatedAt: Date, now: Date = new Date()): string {
  const { short } = originLabel(origin)
  if (origin.kind === "server" && (origin.source === "push" || origin.source === "pull")) {
    return `Data: ${short} · trawled ${format(generatedAt, isSameDay(generatedAt, now) ? "HH:mm" : "d MMM, HH:mm")}`
  }
  return `Data: ${short} · generated ${format(generatedAt, "d MMM yyyy")}`
}
