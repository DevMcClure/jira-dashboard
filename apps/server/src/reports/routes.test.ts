import { afterEach, describe, expect, it } from "vitest"
import { createCrowdAuthProvider } from "../auth/crowd-provider"
import { startMockCrowd } from "../auth/testing/mock-crowd"
import { CONTRACT_JSON, makeApp, signIn } from "../testkit"

const apps: Awaited<ReturnType<typeof makeApp>>["app"][] = []
let clock = new Date("2026-10-20T09:00:00Z")
const make = async (opts: Parameters<typeof makeApp>[0] = {}) => {
  clock = new Date("2026-10-20T09:00:00Z")
  const made = await makeApp({ now: () => clock, env: { INGEST_TOKEN: "t".repeat(32), ...opts.env }, ...opts })
  apps.push(made.app)
  return made
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
})
type App = Awaited<ReturnType<typeof make>>["app"]

/** A valid v1 report config (the seeded mock data's "now" is 19 Oct, 17:00). */
const config = (over: Record<string, unknown> = {}) => ({
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
  ...over,
})
const frozenConfig = (over: Record<string, unknown> = {}) =>
  config({ kind: "frozen", from: "2026-10-13T00:00:00.000Z", to: "2026-10-19T17:00:00.000Z", title: "Frozen", ...over })

const json = (app: App, method: "POST" | "PATCH", url: string, cookie: string, body: unknown) =>
  app.inject({ method, url, payload: JSON.stringify(body), headers: { cookie, "content-type": "application/json" } })
const get = (app: App, url: string, cookie?: string) => app.inject({ url, headers: cookie ? { cookie } : {} })
const morganRecipient = { users: [{ id: "morgan.manager", displayName: "Morgan Lee" }], groups: [] }

describe("B5 acceptance: sharing a report with the Manager", () => {
  it("Sam shares it, Morgan finds it under Shared with me with those filters, and can't open Ada's", async () => {
    const { app } = await make()
    const sam = await signIn(app, "sam.scrum")
    const created = await json(app, "POST", "/api/reports", sam, { config: config() })
    expect(created.statusCode).toBe(201)
    const { id } = created.json()
    expect((await json(app, "PATCH", `/api/reports/${id}`, sam, { recipients: morganRecipient })).json().recipients.users).toEqual(morganRecipient.users)

    const ada = await signIn(app, "ada.admin")
    const adas = (await json(app, "POST", "/api/reports", ada, { config: config({ title: "Ada's private notes" }) })).json()

    const morgan = await signIn(app, "morgan.manager")
    const shared = (await get(app, "/api/reports?box=shared", morgan)).json().reports
    expect(shared.map((r: { config: { title: string }; unread: boolean; owner: { displayName: string } }) => [r.config.title, r.unread, r.owner.displayName])).toEqual([
      ["WEB 26.4.4 status", true, "Sam Rivers"],
    ])
    const opened = (await get(app, `/api/reports/${id}`, morgan)).json()
    expect(opened.config).toEqual(config())
    expect(opened).toMatchObject({ canEdit: false, unread: false })
    expect((await get(app, "/api/reports?box=shared", morgan)).json().reports[0].unread).toBe(false)

    const denied = await get(app, `/api/reports/${adas.id}`, morgan)
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error).toMatch(/Ask its owner to share it/)
  })
})

describe("report access", () => {
  it("lets group members in, 404s unknown reports, and needs a session", async () => {
    const { app } = await make()
    const ada = await signIn(app, "ada.admin")
    const { id } = (await json(app, "POST", "/api/reports", ada, { config: config(), recipients: { users: [], groups: ["jira-dashboard-authors"] } })).json()
    const sam = await signIn(app, "sam.scrum") // in jira-dashboard-authors
    expect((await get(app, `/api/reports/${id}`, sam)).statusCode).toBe(200)
    expect((await get(app, "/api/reports?box=shared", sam)).json().reports).toHaveLength(1)
    const morgan = await signIn(app, "morgan.manager") // in no group
    expect((await get(app, `/api/reports/${id}`, morgan)).statusCode).toBe(403)
    expect((await get(app, "/api/reports/nope", morgan)).statusCode).toBe(404)
    expect((await get(app, `/api/reports/${id}`)).statusCode).toBe(401)
  })

  it("lets authors create, not viewers; only the owner changes or deletes", async () => {
    const { app } = await make()
    const morgan = await signIn(app, "morgan.manager")
    expect((await json(app, "POST", "/api/reports", morgan, { config: config() })).statusCode).toBe(403)
    const sam = await signIn(app, "sam.scrum")
    expect((await json(app, "POST", "/api/reports", sam, { config: { title: "" } })).statusCode).toBe(400)
    const bad = await app.inject({ method: "POST", url: "/api/reports", payload: JSON.stringify({ config: config() }), headers: { cookie: sam, "content-type": "text/plain" } })
    expect(bad.statusCode).toBe(415)
    const { id } = (await json(app, "POST", "/api/reports", sam, { config: config(), recipients: morganRecipient })).json()
    expect((await json(app, "PATCH", `/api/reports/${id}`, morgan, { recipients: { users: [], groups: [] } })).statusCode).toBe(403)
    expect((await app.inject({ method: "DELETE", url: `/api/reports/${id}`, headers: { cookie: morgan } })).statusCode).toBe(403)
    expect((await app.inject({ method: "DELETE", url: `/api/reports/${id}`, headers: { cookie: sam } })).statusCode).toBe(204)
    expect((await get(app, `/api/reports/${id}`, sam)).statusCode).toBe(404)
  })

  it("never lists the owner as a recipient, and marks a report unread again when it changes", async () => {
    const { app } = await make()
    const sam = await signIn(app, "sam.scrum")
    const created = (await json(app, "POST", "/api/reports", sam, {
      config: config(),
      recipients: { users: [{ id: "sam.scrum", displayName: "Sam" }, ...morganRecipient.users, ...morganRecipient.users], groups: [] },
    })).json()
    expect(created.recipients.users.map((u: { id: string }) => u.id)).toEqual(["morgan.manager"])
    expect((await get(app, "/api/reports?box=mine", sam)).json().reports[0]).toMatchObject({ unread: false, canEdit: true })

    const morgan = await signIn(app, "morgan.manager")
    await get(app, `/api/reports/${created.id}`, morgan)
    clock = new Date("2026-10-20T10:00:00Z")
    await json(app, "PATCH", `/api/reports/${created.id}`, sam, { config: config({ note: "Look at Details" }) })
    expect((await get(app, "/api/reports?box=shared", morgan)).json().reports[0]).toMatchObject({ unread: true, config: { note: "Look at Details" } })
  })
})

describe("frozen reports", () => {
  it("keep the data they were made from, through later ingests and retention", async () => {
    const { app, store } = await make()
    const sam = await signIn(app, "sam.scrum")
    const frozen = (await json(app, "POST", "/api/reports", sam, { config: frozenConfig(), recipients: morganRecipient })).json()
    expect(frozen).toMatchObject({ frozen: true, frozenIngestId: (await store.meta())!.id })
    const before = (await store.current())!.json

    // Twelve newer exports: retention keeps 10 texts, but never the pinned one.
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({ method: "POST", url: "/api/ingest", payload: CONTRACT_JSON, headers: { authorization: `Bearer ${"t".repeat(32)}` } })
      expect(res.statusCode).toBe(201)
    }
    const morgan = await signIn(app, "morgan.manager")
    const data = await get(app, `/api/reports/${frozen.id}/data`, morgan)
    expect(data.statusCode).toBe(200)
    expect(data.body).toBe(before)
    expect(data.headers["x-ingest-id"]).toBe(frozen.frozenIngestId)
    expect(store.texts.size).toBe(11) // the newest 10 + the pinned one
  })

  it("must be made from the server's current data, and only they have /data", async () => {
    const { app } = await make()
    const sam = await signIn(app, "sam.scrum")
    const stale = await json(app, "POST", "/api/reports", sam, { config: frozenConfig({ dataStamp: "2026-10-01T00:00:00.000Z" }) })
    expect(stale.statusCode).toBe(409)
    const live = (await json(app, "POST", "/api/reports", sam, { config: config() })).json()
    expect((await get(app, `/api/reports/${live.id}/data`, sam)).statusCode).toBe(404)
    // Turning a frozen report live releases its pin.
    const frozen = (await json(app, "POST", "/api/reports", sam, { config: frozenConfig() })).json()
    const unfrozen = (await json(app, "PATCH", `/api/reports/${frozen.id}`, sam, { config: config() })).json()
    expect(unfrozen).toMatchObject({ frozen: false, frozenIngestId: null })
  })
})

describe("GET /api/directory/search", () => {
  it("finds personas and role groups with mock sign-in", async () => {
    const { app } = await make()
    const sam = await signIn(app)
    const res = (await get(app, "/api/directory/search?q=mor", sam)).json()
    expect(res.users).toEqual([{ id: "morgan.manager", displayName: "Morgan Lee", email: "morgan.lee@example.com" }])
    expect((await get(app, "/api/directory/search?q=dashboard", sam)).json().groups).toEqual(["jira-dashboard-admins", "jira-dashboard-authors"])
    expect((await get(app, "/api/directory/search?q=m", sam)).statusCode).toBe(400)
    expect((await get(app, "/api/directory/search?q=mor")).statusCode).toBe(401)
  })

  it("searches Crowd with CQL, without letting quotes through", async () => {
    const crowd = await startMockCrowd({
      app: { name: "jira-dashboard", password: "app-placeholder" },
      users: {
        "jo.dev": { password: "pw", displayName: "Jo Developer", email: "jo@example.com", groups: ["jira-dashboard-authors", "engineering"] },
        "kim.lead": { password: "pw", displayName: "Kim Lead", email: "kim@example.com", groups: ["jira-dashboard-admins"] },
      },
    })
    try {
      const { app } = await make({
        env: { AUTH_PROVIDER: "crowd", CROWD_URL: crowd.url, CROWD_APP_NAME: "jira-dashboard", CROWD_APP_PASSWORD: "app-placeholder" },
        provider: (env) => createCrowdAuthProvider(env),
      })
      const jo = await signIn(app, "jo.dev", "pw")
      expect((await get(app, "/api/directory/search?q=Kim", jo)).json()).toEqual({ users: [{ id: "kim.lead", displayName: "Kim Lead", email: "kim@example.com" }], groups: [] })
      expect((await get(app, "/api/directory/search?q=eng", jo)).json().groups).toEqual(["engineering"])
      await get(app, `/api/directory/search?q=${encodeURIComponent('k" or name = "*')}`, jo)
      expect(crowd.searches.at(-2)).toBe('name = "k or name =*" or displayName = "k or name =*" or email = "k or name =*"')
    } finally {
      await crowd.close()
    }
  })
})
