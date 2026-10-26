/**
 * Puts the mock data in an empty database, so a fresh install has something to
 * show (SEED_MOCK=true). The sample is bundled into the server build, so this
 * works from any working directory.
 */
import { parseExportText } from "@jira-dashboard/core/adapter"
import sample from "../../web/public/sample/jira-export.json" with { type: "json" }
import type { DatasetStore, Ingest } from "./dataset-store"

/** The sample exactly as the mock generator writes it (2-space JSON plus a newline). */
export const SAMPLE_JSON = `${JSON.stringify(sample, null, 2)}\n`

/** Store `json` as the current dataset if there's none yet. Validates it first (throws on bad data). */
export async function seedIfEmpty(store: DatasetStore, json: string = SAMPLE_JSON): Promise<Ingest | null> {
  if (await store.current()) return null
  const dataset = parseExportText(json)
  return store.insertCurrent({
    json,
    source: "seed",
    generatedAt: dataset.meta.generatedAt,
    counts: {
      teams: dataset.teams.length,
      people: dataset.people.length,
      sprints: dataset.sprints.length,
      issues: dataset.issues.length,
    },
  })
}
