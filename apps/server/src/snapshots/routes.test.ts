import { afterEach, describe, expect, it } from "vitest"
import { makeApp, signIn } from "../testkit"
import { MAX_RANGE_DAYS } from "./routes"

const apps: Awaited<ReturnType<typeof makeApp>>["app"][] = []
const make = async (opts: Parameters<typeof makeApp>[0] = {}) => {
  const made = await makeApp({ now: () => new Date("2026-10-20T06:00:00Z"), ...opts })
  apps.push(made.app)
  return made
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
})
type App = Awaited<ReturnType<typeof make>>["app"]
const runJob = (app: App, cookie: string | undefined, body: unknown = {}, contentType = "application/json") =>
  app.inject({ method: "POST", url: "/api/jobs/snapshot", payload: JSON.stringify(body), headers: { "content-type": contentType, ...(cookie ? { cookie } : {}) } })

describe("POST /api/jobs/snapshot", () => {
  it("lets admins snapshot yesterday (by default) or a given day", async () => {
    const { app, snapshots } = await make()
    const ada = await signIn(app, "ada.admin")
    const res = await runJob(app, ada)
    // "Now" is 20 Oct, so yesterday is 19 Oct, the data's own day.
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ date: "2026-10-19", stale: true, teams: [{ teamId: "TEAM-PLAT", result: "written" }, {}, {}] })
    expect((await runJob(app, ada, { date: "2026-10-14" })).json().teams.map((t: { result: string }) => t.result)).toEqual(["written", "written", "written"])
    expect(snapshots.docs.size).toBe(6)
  })

  it("is for admins, takes JSON, and explains bad days", async () => {
    const { app } = await make()
    expect((await runJob(app, undefined)).statusCode).toBe(401)
    expect((await runJob(app, await signIn(app, "sam.scrum"))).statusCode).toBe(403)
    const ada = await signIn(app, "ada.admin")
    expect((await runJob(app, ada, {}, "text/plain")).statusCode).toBe(415)
    expect((await runJob(app, ada, { date: "yesterday" })).statusCode).toBe(400)
    const later = await runJob(app, ada, { date: "2026-10-25" })
    expect(later.statusCode).toBe(422)
    expect(later.json().error).toBe("2026-10-25 hasn't happened yet.")
  })

  it("is 409 before there's any data", async () => {
    const { app } = await make({ seed: false })
    expect((await runJob(app, await signIn(app, "ada.admin"))).statusCode).toBe(409)
  })
})

describe("GET /api/snapshots", () => {
  it("lists a team's days without the ticket rows, and gives one day in full", async () => {
    const { app } = await make()
    const ada = await signIn(app, "ada.admin")
    for (const date of ["2026-10-13", "2026-10-14", "2026-10-15"]) await runJob(app, ada, { date })
    const morgan = await signIn(app, "morgan.manager")
    const list = await app.inject({ url: "/api/snapshots?teamId=TEAM-WEB&from=2026-10-14&to=2026-10-31", headers: { cookie: morgan } })
    expect(list.statusCode).toBe(200)
    const { snapshots } = list.json()
    expect(snapshots.map((s: { date: string }) => s.date)).toEqual(["2026-10-14", "2026-10-15"])
    expect(snapshots[0]).not.toHaveProperty("issues")
    expect(snapshots[0]).not.toHaveProperty("hash")
    expect(snapshots[0]).toMatchObject({ teamId: "TEAM-WEB", schemaVersion: 1, sprint: { name: expect.any(String) } })

    const one = await app.inject({ url: "/api/snapshots/TEAM-WEB/2026-10-14", headers: { cookie: morgan } })
    expect(one.json().issues.length).toBeGreaterThan(0)
    expect(one.json()).not.toHaveProperty("hash")
    expect((await app.inject({ url: "/api/snapshots/TEAM-WEB/2026-10-01", headers: { cookie: morgan } })).statusCode).toBe(404)
  })

  it("needs a session and a sensible range", async () => {
    const { app } = await make()
    expect((await app.inject({ url: "/api/snapshots?teamId=TEAM-WEB&from=2026-10-01&to=2026-10-02" })).statusCode).toBe(401)
    const cookie = await signIn(app)
    const get = (q: string) => app.inject({ url: `/api/snapshots?${q}`, headers: { cookie } })
    expect((await get("teamId=TEAM-WEB&from=2026-10-02&to=2026-10-01")).statusCode).toBe(400)
    expect((await get("teamId=TEAM-WEB&from=2026-10-01")).statusCode).toBe(400)
    expect((await get("teamId=TEAM-WEB&from=2026-02-30&to=2026-03-01")).statusCode).toBe(400)
    expect((await get(`teamId=TEAM-WEB&from=2025-01-01&to=2026-12-31`)).json().error).toMatch(String(MAX_RANGE_DAYS))
    expect((await app.inject({ url: "/api/snapshots/TEAM-WEB/14-10-2026", headers: { cookie } })).statusCode).toBe(400)
  })
})
