import fixture from "@jira-dashboard/core/__fixtures__/small-export.json"
import { JiraExportError } from "@jira-dashboard/core/adapter"
import { describe, expect, it, vi } from "vitest"
import { createApiDataSource } from "./api-data-source"

const SAMPLE = JSON.stringify(fixture)
const ok = (body: string, headers: Record<string, string> = { "x-ingest-id": "ing-1" }) =>
  vi.fn<typeof globalThis.fetch>(async () => new Response(body, { status: 200, headers }))

describe("createApiDataSource", () => {
  it("loads the server's current dataset, keeping its ingest id and exact text", async () => {
    const fetch = ok(SAMPLE)
    const data = await createApiDataSource({ baseUrl: "/api", fetch }).load()
    expect(fetch).toHaveBeenCalledWith("/api/dataset", expect.objectContaining({ credentials: "include" }))
    expect(data.origin).toEqual({ kind: "server", ingestId: "ing-1" })
    expect(data.rawJson).toBe(SAMPLE)
    expect(data.dataset.issues.map((i) => i.key)).toEqual(["TST-1", "TST-2", "TST-3"])
  })

  it("explains an empty server, a server error and an unreachable server", async () => {
    const empty = vi.fn<typeof globalThis.fetch>(async () => new Response("{}", { status: 404 }))
    await expect(createApiDataSource({ baseUrl: "/api", fetch: empty }).load()).rejects.toThrow(/no data yet/)
    const broken = vi.fn<typeof globalThis.fetch>(async () => new Response("", { status: 500, statusText: "Internal Server Error" }))
    await expect(createApiDataSource({ baseUrl: "/api", fetch: broken }).load()).rejects.toThrow(/500/)
    const down = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError("fetch failed")
    })
    await expect(createApiDataSource({ baseUrl: "https://x.example/api", fetch: down }).load()).rejects.toThrow(/Couldn't reach the dashboard server at https:\/\/x\.example\/api/)
  })

  it("rejects a server response that isn't a valid export", async () => {
    await expect(createApiDataSource({ baseUrl: "/api", fetch: ok('{"issues": [{}]}') }).load()).rejects.toBeInstanceOf(JiraExportError)
  })

  it("previews a dropped file locally without keeping it", async () => {
    const fetch = ok(SAMPLE)
    const src = createApiDataSource({ baseUrl: "/api", fetch })
    const { data, remembered } = await src.loadFile({ name: "mine.json", text: async () => SAMPLE })
    expect(remembered).toBe(false)
    expect(data.origin).toMatchObject({ kind: "upload", fileName: "mine.json" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("reset goes back to the server's data", async () => {
    const fetch = ok(SAMPLE)
    expect((await createApiDataSource({ baseUrl: "/api", fetch }).reset()).origin.kind).toBe("server")
  })
})
