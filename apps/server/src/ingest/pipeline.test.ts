import { describe, expect, it } from "vitest"
import { createMemoryDatasetStore } from "../dataset-store"
import { seedIfEmpty } from "../seed"
import { CONTRACT_JSON, NOT_AN_EXPORT, TRAWLER_JSON, TRAWLER_LOG } from "../testkit"
import { createIngestPipeline, sha256 } from "./pipeline"

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
const setup = (keep?: number) => {
  const store = createMemoryDatasetStore()
  return { store, pipeline: createIngestPipeline({ store, log: quiet, keep }) }
}

describe("createIngestPipeline", () => {
  it.each([
    ["the contract shape", CONTRACT_JSON, 3],
    ["raw Trawler JSON", TRAWLER_JSON, 2],
    ["a Trawler audit log", TRAWLER_LOG, 1],
  ])("makes %s current, exactly as sent", async (_name, text, issues) => {
    const { store, pipeline } = setup()
    const result = await pipeline.ingest(text, { source: "push" })
    expect(result).toMatchObject({ ok: true, unchanged: false, ingest: { status: "current", source: "push", counts: { issues } } })
    expect(result.ingest).toMatchObject({ sha256: sha256(text), bytes: Buffer.byteLength(text) })
    expect((await store.current())?.json).toBe(text)
  })

  it("records a rejected export and leaves the current data alone", async () => {
    const { store, pipeline } = setup()
    const first = await pipeline.ingest(CONTRACT_JSON, { source: "push" })

    const bad = await pipeline.ingest(NOT_AN_EXPORT, { source: "push" })
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.problems.length).toBeGreaterThan(0)
    expect(bad.problems[0]).toMatch(/^issues\.0\./)
    expect(bad.ingest).toMatchObject({ status: "rejected", datasetId: null, errors: bad.problems })

    const truncated = await pipeline.ingest(CONTRACT_JSON.slice(0, 100), { source: "push" })
    expect(truncated).toMatchObject({ ok: false, problems: [expect.stringMatching(/^Not valid JSON: /)] })

    expect((await store.meta())?.id).toBe(first.ingest.id)
    expect((await store.current())?.json).toBe(CONTRACT_JSON)
  })

  it("keeps only the first 50 problems", async () => {
    const { pipeline } = setup()
    const many = JSON.stringify({ issues: Array.from({ length: 80 }, () => ({})) })
    const result = await pipeline.ingest(many, { source: "push" })
    expect(!result.ok && result.problems).toHaveLength(50)
  })

  it("handles simultaneous ingests one at a time", async () => {
    const { store, pipeline } = setup()
    const results = await Promise.all(Array.from({ length: 5 }, () => pipeline.ingest(CONTRACT_JSON, { source: "push" })))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(store.ingests.filter((i) => i.status === "current")).toHaveLength(1)
    expect((await store.meta())?.id).toBe(results[4].ingest.id)
  })

  it("always stores a push, but skips a pull identical to the current data", async () => {
    const { store, pipeline } = setup()
    await pipeline.ingest(CONTRACT_JSON, { source: "push" })
    await pipeline.ingest(CONTRACT_JSON, { source: "push" })
    expect(store.ingests).toHaveLength(2)

    const same = await pipeline.ingest(CONTRACT_JSON, { source: "pull", onlyIfChanged: true })
    expect(same).toMatchObject({ ok: true, unchanged: true })
    expect(store.ingests).toHaveLength(2)

    const changed = await pipeline.ingest(TRAWLER_JSON, { source: "pull", onlyIfChanged: true })
    expect(changed).toMatchObject({ ok: true, unchanged: false, ingest: { source: "pull" } })
    expect(store.ingests).toHaveLength(3)
  })

  it("records who published an upload", async () => {
    const { pipeline } = setup()
    const result = await pipeline.ingest(CONTRACT_JSON, { source: "upload", uploadedBy: "ada.admin", fileName: "trawl.json" })
    expect(result.ingest).toMatchObject({ source: "upload", uploadedBy: "ada.admin", fileName: "trawl.json" })
  })

  it("keeps the newest texts (the seed included) and every ingest record", async () => {
    const { store, pipeline } = setup(3)
    await seedIfEmpty(store, CONTRACT_JSON)
    for (let i = 0; i < 4; i++) await pipeline.ingest(`${CONTRACT_JSON}${" ".repeat(i)}`, { source: "push" })
    expect(store.ingests).toHaveLength(5)
    expect(store.texts.size).toBe(3)
    expect(store.ingests.map((i) => i.datasetId !== null)).toEqual([false, false, true, true, true])
    expect((await store.current())?.json).toBe(`${CONTRACT_JSON}   `)
  })

  it("passes on store failures rather than calling them invalid data", async () => {
    const store = createMemoryDatasetStore()
    store.insertCurrent = async () => {
      throw new Error("disk full")
    }
    const pipeline = createIngestPipeline({ store, log: quiet })
    await expect(pipeline.ingest(CONTRACT_JSON, { source: "push" })).rejects.toThrow("disk full")
    // The queue keeps working after a failure.
    await expect(pipeline.ingest(NOT_AN_EXPORT, { source: "push" })).resolves.toMatchObject({ ok: false })
  })
})
