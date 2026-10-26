import { describe, expect, it } from "vitest"
import { createLocalReportStore, REPORTS_STORAGE_KEY } from "./local-report-store"

type Config = { title: string }
const parse = (raw: unknown): Config | null =>
  typeof raw === "object" && raw !== null && typeof (raw as Config).title === "string" ? (raw as Config) : null

function setup(initial?: unknown, opts: { failWrites?: boolean; failReads?: boolean } = {}) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(REPORTS_STORAGE_KEY, typeof initial === "string" ? initial : JSON.stringify(initial))
  const storage = {
    getItem: (k: string) => {
      if (opts.failReads) throw new Error("SecurityError")
      return map.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new Error("QuotaExceededError")
      map.set(k, v)
    },
  }
  let clock = Date.parse("2026-10-26T09:00:00Z")
  let n = 0
  const store = createLocalReportStore<Config>({
    parse,
    storage,
    now: () => new Date((clock += 60_000)),
    newId: () => `r${++n}`,
  })
  return { store, map }
}

describe("createLocalReportStore", () => {
  it("starts empty", async () => {
    const { store } = setup()
    expect(await store.list()).toEqual([])
    expect(await store.get("r1")).toBeNull()
  })

  it("saves a new report with an id and timestamps, and reads it back", async () => {
    const { store, map } = setup()
    const saved = await store.save({ config: { title: "WEB 26.4.4 status" } })
    expect(saved).toEqual({
      id: "r1",
      createdAt: "2026-10-26T09:01:00.000Z",
      updatedAt: "2026-10-26T09:01:00.000Z",
      config: { title: "WEB 26.4.4 status" },
    })
    expect(await store.get("r1")).toEqual(saved)
    expect(JSON.parse(map.get(REPORTS_STORAGE_KEY)!)).toEqual([saved])
  })

  it("replaces an existing report, keeping its createdAt", async () => {
    const { store } = setup()
    const first = await store.save({ config: { title: "A" } })
    const updated = await store.save({ id: first.id, config: { title: "A v2" } })
    expect(updated).toMatchObject({ id: "r1", createdAt: first.createdAt, config: { title: "A v2" } })
    expect(updated.updatedAt > first.updatedAt).toBe(true)
    expect(await store.list()).toHaveLength(1)
  })

  it("lists the most recently updated first", async () => {
    const { store } = setup()
    await store.save({ config: { title: "A" } })
    await store.save({ config: { title: "B" } })
    await store.save({ id: "r1", config: { title: "A again" } })
    expect((await store.list()).map((r) => r.config.title)).toEqual(["A again", "B"])
  })

  it("removes a report; removing an unknown id is a no-op", async () => {
    const { store } = setup()
    await store.save({ config: { title: "A" } })
    await store.remove("nope")
    await store.remove("r1")
    expect(await store.list()).toEqual([])
  })

  it("drops entries that are malformed or whose config fails to parse", async () => {
    const good = { id: "x", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", config: { title: "ok" } }
    const { store } = setup([good, { ...good, id: "y", config: { title: 3 } }, { id: 1 }, null, "junk"])
    expect((await store.list()).map((r) => r.id)).toEqual(["x"])
  })

  it("treats unreadable JSON as empty", async () => {
    expect(await setup("{oops").store.list()).toEqual([])
    expect(await setup({ not: "an array" }).store.list()).toEqual([])
  })

  it("rejects when storage can't be read or written", async () => {
    await expect(setup(undefined, { failReads: true }).store.list()).rejects.toThrow("SecurityError")
    await expect(setup(undefined, { failWrites: true }).store.save({ config: { title: "A" } })).rejects.toThrow(
      "QuotaExceededError",
    )
  })
})
