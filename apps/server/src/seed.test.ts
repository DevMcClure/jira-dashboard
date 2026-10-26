import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createMemoryDatasetStore } from "./dataset-store"
import { SAMPLE_JSON, seedIfEmpty } from "./seed"

describe("seedIfEmpty", () => {
  it("bundles the sample byte-for-byte as the web app serves it", () => {
    const file = readFileSync(new URL("../../web/public/sample/jira-export.json", import.meta.url), "utf8")
    expect(SAMPLE_JSON).toBe(file)
  })

  it("stores the sample once, as a validated seed ingest", async () => {
    const store = createMemoryDatasetStore()
    const ingest = await seedIfEmpty(store)
    expect(ingest).toMatchObject({ source: "seed", status: "current", counts: { teams: 3 } })
    expect(ingest!.counts.issues).toBeGreaterThan(400)
    expect(ingest!.generatedAt?.toISOString()).toBe("2026-10-19T17:00:00.000Z")
    // A second start finds data and does nothing.
    expect(await seedIfEmpty(store)).toBeNull()
    expect(store.ingests).toHaveLength(1)
  })

  it("refuses data that isn't a valid export, leaving the store empty", async () => {
    const store = createMemoryDatasetStore()
    await expect(seedIfEmpty(store, '{"issues": "nope"}')).rejects.toThrow()
    expect(await store.current()).toBeNull()
  })
})
