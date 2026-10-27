import { describe, expect, it, vi } from "vitest"
import { authEvents, UNAUTHORIZED_EVENT } from "@/lib/auth/auth-client"
import { createApiReportStore } from "./api-report-store"
import { ReportStoreError } from "./report-store"

const config = {
  schemaVersion: 1,
  title: "WEB 26.4.4 status",
  note: "",
  author: "sam.scrum",
  kind: "live",
  scope: "sprint",
  piId: null,
  sprintIds: [204],
  teamIds: ["TEAM-WEB"],
  assigneeIds: [],
  period: "7d",
  pages: ["overview", "details"],
  landingPage: "overview",
  dataStamp: "2026-10-19T17:00:00.000Z",
}
const report = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  createdAt: "2026-10-20T09:00:00.000Z",
  updatedAt: "2026-10-20T09:00:00.000Z",
  config,
  owner: { id: "sam.scrum", displayName: "Sam Rivers" },
  recipients: { users: [], groups: [] },
  unread: false,
  canEdit: true,
  frozenIngestId: null,
  ...over,
})
const replies = (...responses: Response[]) => {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const r of responses) fetch.mockResolvedValueOnce(r)
  return fetch
}

describe("createApiReportStore", () => {
  it("lists mine and shared, validating every config", async () => {
    const fetch = replies(Response.json({ reports: [report(), report({ id: "bad", config: { title: "" } })] }), Response.json({ reports: [report({ id: "r2", unread: true, canEdit: false })] }))
    const store = createApiReportStore({ baseUrl: "/api", fetch })
    expect((await store.list()).map((r) => r.id)).toEqual(["r1"])
    expect(await store.listShared!()).toEqual([expect.objectContaining({ id: "r2", unread: true, owner: { id: "sam.scrum", displayName: "Sam Rivers" } })])
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/reports?box=mine", "/api/reports?box=shared"])
  })

  it("tells a missing report (null) from one you can't open (403)", async () => {
    const fetch = replies(Response.json({ error: "There's no such report." }, { status: 404 }), Response.json({ error: "You don't have access to this report." }, { status: 403 }))
    const store = createApiReportStore({ baseUrl: "/api", fetch })
    expect(await store.get("nope")).toBeNull()
    const err = await store.get("ada-private").catch((e) => e)
    expect(err).toBeInstanceOf(ReportStoreError)
    expect(err).toMatchObject({ status: 403, message: "You don't have access to this report." })
  })

  it("creates without an id, updates with one, and shares", async () => {
    const fetch = replies(Response.json(report(), { status: 201 }), Response.json(report({ updatedAt: "2026-10-20T10:00:00.000Z" })), Response.json(report({ recipients: { users: [{ id: "morgan.manager", displayName: "Morgan Lee" }], groups: [] } })))
    const store = createApiReportStore({ baseUrl: "/api", fetch })
    await store.save({ config: config as never })
    await store.save({ id: "r1", config: config as never })
    const shared = await store.share!("r1", { users: [{ id: "morgan.manager", displayName: "Morgan Lee" }], groups: [] })
    expect(fetch.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/reports", "POST"],
      ["/api/reports/r1", "PATCH"],
      ["/api/reports/r1", "PATCH"],
    ])
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toEqual({ recipients: { users: [{ id: "morgan.manager", displayName: "Morgan Lee" }], groups: [] } })
    expect(shared.recipients?.users).toHaveLength(1)
  })

  it("passes on the server's reason, and signals sign-in on 401", async () => {
    const heard = vi.fn()
    authEvents.addEventListener(UNAUTHORIZED_EVENT, heard)
    const fetch = replies(Response.json({ error: "A frozen report must be made from the server's current data." }, { status: 409 }), new Response("{}", { status: 401 }))
    const store = createApiReportStore({ baseUrl: "/api", fetch })
    await expect(store.save({ config: config as never })).rejects.toThrow(/server's current data/)
    await expect(store.list()).rejects.toMatchObject({ status: 401 })
    authEvents.removeEventListener(UNAUTHORIZED_EVENT, heard)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it("fetches a frozen report's data as text", async () => {
    const store = createApiReportStore({ baseUrl: "/api", fetch: replies(new Response('{"meta":{}}')) })
    expect(await store.data!("r1")).toBe('{"meta":{}}')
  })
})
