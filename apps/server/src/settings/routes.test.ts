import { DEFAULT_FLOW_CONFIG } from "@jira-dashboard/core/flowConfig"
import { afterEach, describe, expect, it } from "vitest"
import { makeApp, signIn } from "../testkit"

const apps: Awaited<ReturnType<typeof makeApp>>["app"][] = []
const make = async () => {
  const made = await makeApp({ now: () => new Date("2026-10-20T06:00:00Z") })
  apps.push(made.app)
  return made
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
})
type App = Awaited<ReturnType<typeof make>>["app"]
const put = (app: App, cookie: string, config: unknown) =>
  app.inject({ method: "PUT", url: "/api/settings/flow", payload: JSON.stringify({ config }), headers: { cookie, "content-type": "application/json" } })
const reviewActive = { ...DEFAULT_FLOW_CONFIG, statusStates: { ...DEFAULT_FLOW_CONFIG.statusStates, "In Review": "active" } }

describe("flow settings", () => {
  it("start as the defaults, for anyone signed in", async () => {
    const { app } = await make()
    expect((await app.inject({ url: "/api/settings/flow" })).statusCode).toBe(401)
    const res = await app.inject({ url: "/api/settings/flow", headers: { cookie: await signIn(app, "morgan.manager") } })
    expect(res.json()).toEqual({ config: DEFAULT_FLOW_CONFIG, isDefault: true, updatedAt: null, updatedBy: null })
  })

  it("are changed and reset by admins only", async () => {
    const { app } = await make()
    for (const persona of ["sam.scrum", "morgan.manager"]) expect((await put(app, await signIn(app, persona), reviewActive)).statusCode).toBe(403)
    const ada = await signIn(app, "ada.admin")
    const saved = await put(app, ada, reviewActive)
    expect(saved.json()).toMatchObject({ isDefault: false, config: { statusStates: { "In Review": "active" } }, updatedBy: { id: "ada.admin", displayName: "Ada Park" }, updatedAt: "2026-10-20T06:00:00.000Z" })
    const morgan = await signIn(app, "morgan.manager")
    expect((await app.inject({ url: "/api/settings/flow", headers: { cookie: morgan } })).json().config.statusStates["In Review"]).toBe("active")
    expect((await app.inject({ method: "DELETE", url: "/api/settings/flow", headers: { cookie: morgan } })).statusCode).toBe(403)
    const reset = await app.inject({ method: "DELETE", url: "/api/settings/flow", headers: { cookie: ada } })
    expect(reset.json()).toMatchObject({ isDefault: true, config: DEFAULT_FLOW_CONFIG })
  })

  it("refuse invalid settings with readable problems", async () => {
    const { app } = await make()
    const ada = await signIn(app, "ada.admin")
    const bad = await put(app, ada, { ...DEFAULT_FLOW_CONFIG, workingHours: { ...DEFAULT_FLOW_CONFIG.workingHours, start: 18, end: 9 } })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().problems).toEqual(["workingHours.end: The working day must end after it starts"])
    const text = await app.inject({ method: "PUT", url: "/api/settings/flow", payload: "{}", headers: { cookie: ada, "content-type": "text/plain" } })
    expect(text.statusCode).toBe(415)
  })

  it("are used by the snapshot job, so a rerun after a change rewrites the day", async () => {
    const { app, snapshots } = await make()
    const ada = await signIn(app, "ada.admin")
    const run = () => app.inject({ method: "POST", url: "/api/jobs/snapshot", payload: JSON.stringify({ date: "2026-10-15" }), headers: { cookie: ada, "content-type": "application/json" } })
    await run()
    const before = (await snapshots.get("TEAM-PLAT", "2026-10-15"))!.flow
    expect((await run()).json().teams.map((t: { result: string }) => t.result)).toEqual(["unchanged", "unchanged", "unchanged"])
    await put(app, ada, reviewActive)
    expect((await run()).json().teams.map((t: { result: string }) => t.result)).toContain("written")
    expect((await snapshots.get("TEAM-PLAT", "2026-10-15"))!.flow.efficiency).not.toBe(before.efficiency)
  })
})
