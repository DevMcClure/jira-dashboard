import { describe, expect, it, vi } from "vitest"
import fixture from "@jira-dashboard/core/__fixtures__/small-export.json"
import { JiraExportError } from "@jira-dashboard/core/adapter"
import { createStaticDataSource, UPLOAD_STORAGE_KEY } from "./static-data-source"

const SAMPLE = JSON.stringify(fixture)
const URL = "/base/sample/jira-export.json"

function memoryStorage(initial: Record<string, string> = {}, opts: { failWrites?: boolean } = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new Error("QuotaExceededError")
      map.set(k, v)
    },
    removeItem: (k: string) => void map.delete(k),
  }
}

const okFetch = () => vi.fn(async () => new Response(SAMPLE, { status: 200 }))
const file = (name: string, text: string) => ({ name, text: async () => text })
const upload = (json: string) => JSON.stringify({ fileName: "mine.json", loadedAt: "2026-10-20T10:00:00.000Z", json })

describe("createStaticDataSource", () => {
  it("loads the sample from its URL when nothing is remembered", async () => {
    const fetch = okFetch()
    const src = createStaticDataSource({ sampleUrl: URL, fetch, storage: memoryStorage() })
    const data = await src.load()
    expect(fetch).toHaveBeenCalledWith(URL)
    expect(data.origin).toEqual({ kind: "sample" })
    expect(data.rawJson).toBe(SAMPLE)
    expect(data.dataset.issues.map((i) => i.key)).toEqual(["TST-1", "TST-2", "TST-3"])
  })

  it("fetches the sample once and reuses it", async () => {
    const fetch = okFetch()
    const src = createStaticDataSource({ sampleUrl: URL, fetch, storage: memoryStorage() })
    await src.load()
    await src.reset()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("prefers a valid remembered upload, without fetching", async () => {
    const fetch = okFetch()
    const storage = memoryStorage({ [UPLOAD_STORAGE_KEY]: upload(SAMPLE) })
    const data = await createStaticDataSource({ sampleUrl: URL, fetch, storage }).load()
    expect(fetch).not.toHaveBeenCalled()
    expect(data.origin).toEqual({ kind: "upload", fileName: "mine.json", loadedAt: "2026-10-20T10:00:00.000Z" })
  })

  it("forgets a remembered upload that no longer parses and falls back to the sample", async () => {
    const storage = memoryStorage({ [UPLOAD_STORAGE_KEY]: upload('{"issues": "nope"}') })
    const data = await createStaticDataSource({ sampleUrl: URL, fetch: okFetch(), storage }).load()
    expect(data.origin.kind).toBe("sample")
    expect(storage.map.has(UPLOAD_STORAGE_KEY)).toBe(false)
  })

  it("loads and remembers a valid file", async () => {
    const storage = memoryStorage()
    const src = createStaticDataSource({ sampleUrl: URL, fetch: okFetch(), storage })
    const { data, remembered } = await src.loadFile(file("export.json", SAMPLE))
    expect(remembered).toBe(true)
    expect(data.origin).toMatchObject({ kind: "upload", fileName: "export.json" })
    expect(JSON.parse(storage.map.get(UPLOAD_STORAGE_KEY)!).fileName).toBe("export.json")
  })

  it("rejects an invalid file and keeps the remembered one", async () => {
    const before = upload(SAMPLE)
    const storage = memoryStorage({ [UPLOAD_STORAGE_KEY]: before })
    const src = createStaticDataSource({ sampleUrl: URL, fetch: okFetch(), storage })
    await expect(src.loadFile(file("bad.json", '{"issues": [{}]}'))).rejects.toBeInstanceOf(JiraExportError)
    await expect(src.loadFile(file("bad.json", "{not json"))).rejects.toBeInstanceOf(SyntaxError)
    expect(storage.map.get(UPLOAD_STORAGE_KEY)).toBe(before)
  })

  it("still loads a file it can't remember, and drops the older remembered one", async () => {
    const storage = memoryStorage({}, { failWrites: true })
    storage.map.set(UPLOAD_STORAGE_KEY, upload(SAMPLE))
    const { data, remembered } = await createStaticDataSource({ sampleUrl: URL, fetch: okFetch(), storage }).loadFile(
      file("huge.json", SAMPLE),
    )
    expect(remembered).toBe(false)
    expect(data.origin).toMatchObject({ fileName: "huge.json" })
    expect(storage.map.has(UPLOAD_STORAGE_KEY)).toBe(false)
  })

  it("reset forgets the upload and returns the sample", async () => {
    const storage = memoryStorage({ [UPLOAD_STORAGE_KEY]: upload(SAMPLE) })
    const data = await createStaticDataSource({ sampleUrl: URL, fetch: okFetch(), storage }).reset()
    expect(data.origin.kind).toBe("sample")
    expect(storage.map.has(UPLOAD_STORAGE_KEY)).toBe(false)
  })

  it("rejects when the sample can't be fetched, and retries on the next call", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404, statusText: "Not Found" }))
      .mockResolvedValueOnce(new Response(SAMPLE, { status: 200 }))
    const src = createStaticDataSource({ sampleUrl: URL, fetch, storage: memoryStorage() })
    await expect(src.load()).rejects.toThrow("404 Not Found")
    await expect(src.load()).resolves.toMatchObject({ origin: { kind: "sample" } })
  })

  it("works without any storage", async () => {
    const src = createStaticDataSource({ sampleUrl: URL, fetch: okFetch(), storage: null })
    expect((await src.load()).origin.kind).toBe("sample")
    expect((await src.loadFile(file("x.json", SAMPLE))).remembered).toBe(false)
  })
})
