import fixture from "@jira-dashboard/core/__fixtures__/small-export.json"
import { JiraExportError } from "@jira-dashboard/core/adapter"
import { describe, expect, it, vi } from "vitest"
import { authEvents, UNAUTHORIZED_EVENT } from "@/lib/auth/auth-client"
import { createApiDataSource } from "./api-data-source"

const SAMPLE = JSON.stringify(fixture)
const ok = (body: string, headers: Record<string, string> = { "x-ingest-id": "ing-1", "x-ingest-source": "push" }) =>
  vi.fn<typeof globalThis.fetch>(async () => new Response(body, { status: 200, headers }))

describe("createApiDataSource", () => {
  it("loads the server's current dataset, keeping its ingest id and exact text", async () => {
    const fetch = ok(SAMPLE)
    const data = await createApiDataSource({ baseUrl: "/api", fetch }).load()
    expect(fetch).toHaveBeenCalledWith("/api/dataset", expect.objectContaining({ credentials: "include" }))
    expect(data.origin).toEqual({ kind: "server", ingestId: "ing-1", source: "push" })
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

  it("signals sign-in when the session has ended", async () => {
    const heard = vi.fn()
    authEvents.addEventListener(UNAUTHORIZED_EVENT, heard)
    const expired = vi.fn<typeof globalThis.fetch>(async () => new Response('{"error":"Sign in to continue."}', { status: 401 }))
    await expect(createApiDataSource({ baseUrl: "/api", fetch: expired }).load()).rejects.toThrow(/session has ended/)
    authEvents.removeEventListener(UNAUTHORIZED_EVENT, heard)
    expect(heard).toHaveBeenCalledTimes(1)
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

  it("leaves the source unknown when the server doesn't say (or says something new)", async () => {
    const data = await createApiDataSource({ baseUrl: "/api", fetch: ok(SAMPLE, { "x-ingest-id": "ing-2", "x-ingest-source": "carrier-pigeon" }) }).load()
    expect(data.origin).toEqual({ kind: "server", ingestId: "ing-2", source: null })
  })

  it("asks for the current ingest id, quietly giving up when it can't", async () => {
    const meta = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ingestId: "ing-9", source: "pull" }))
    const src = createApiDataSource({ baseUrl: "/api", fetch: meta })
    expect(await src.latestVersion!()).toBe("ing-9")
    expect(meta).toHaveBeenCalledWith("/api/dataset/meta", expect.objectContaining({ credentials: "include", cache: "no-store" }))
    const empty = vi.fn<typeof globalThis.fetch>(async () => new Response("{}", { status: 404 }))
    expect(await createApiDataSource({ baseUrl: "/api", fetch: empty }).latestVersion!()).toBeNull()
  })

  it("signals sign-in when a poll finds the session gone", async () => {
    const heard = vi.fn()
    authEvents.addEventListener(UNAUTHORIZED_EVENT, heard)
    const expired = vi.fn<typeof globalThis.fetch>(async () => new Response("{}", { status: 401 }))
    expect(await createApiDataSource({ baseUrl: "/api", fetch: expired }).latestVersion!()).toBeNull()
    authEvents.removeEventListener(UNAUTHORIZED_EVENT, heard)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it("publishes a file as JSON, then loads the server's new data", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    fetch.mockResolvedValueOnce(Response.json({ ingest: { id: "ing-5" } }, { status: 201 }))
    fetch.mockResolvedValueOnce(new Response(SAMPLE, { headers: { "x-ingest-id": "ing-5", "x-ingest-source": "upload" } }))
    const data = await createApiDataSource({ baseUrl: "/api", fetch }).publishFile!({ name: "mine.json", text: async () => SAMPLE })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe("/api/ingest/upload")
    expect(init).toMatchObject({ method: "POST", credentials: "include", body: JSON.stringify({ fileName: "mine.json", text: SAMPLE }) })
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json")
    expect(data.origin).toEqual({ kind: "server", ingestId: "ing-5", source: "upload" })
  })

  it("turns the server's verdict on a bad file into the same errors as a local one", async () => {
    const file = { name: "bad.json", text: async () => "{}" }
    const invalid = vi.fn<typeof globalThis.fetch>(async () => Response.json({ error: "no", problems: ["issues: Required"] }, { status: 422 }))
    const err = await createApiDataSource({ baseUrl: "/api", fetch: invalid }).publishFile!(file).catch((e) => e)
    expect(err).toBeInstanceOf(JiraExportError)
    expect(err.problems).toEqual(["issues: Required"])

    const forbidden = vi.fn<typeof globalThis.fetch>(async () => Response.json({ error: "This needs the admin role." }, { status: 403 }))
    await expect(createApiDataSource({ baseUrl: "/api", fetch: forbidden }).publishFile!(file)).rejects.toThrow("This needs the admin role.")
    const tooBig = vi.fn<typeof globalThis.fetch>(async () => Response.json({ error: "Payload Too Large" }, { status: 413 }))
    await expect(createApiDataSource({ baseUrl: "/api", fetch: tooBig }).publishFile!(file)).rejects.toThrow(/INGEST_MAX_MB/)
  })
})
