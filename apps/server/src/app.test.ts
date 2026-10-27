import { afterEach, describe, expect, it } from "vitest"
import { makeApp, signIn } from "./testkit"

const apps: Awaited<ReturnType<typeof makeApp>>["app"][] = []
const make = async (opts: { basePath?: string; failPing?: boolean; seed?: boolean } = {}) => {
  const made = await makeApp({ env: opts.basePath ? { BASE_PATH: opts.basePath } : {}, failPing: opts.failPing, seed: opts.seed })
  apps.push(made.app)
  return made
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
})

describe("GET /api/health", () => {
  it("is ok while the database answers", async () => {
    const { app } = await make()
    const res = await app.inject({ url: "/api/health" })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: "ok", db: "ok", version: "1.2.3" })
  })

  it("is 503 when the database is down", async () => {
    const { app } = await make({ failPing: true })
    const res = await app.inject({ url: "/api/health" })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ status: "degraded", db: "down" })
  })
})

describe("GET /api/config", () => {
  it("reports api mode, the sign-in provider, and which features are on", async () => {
    const { app } = await make()
    expect((await app.inject({ url: "/api/config" })).json()).toEqual({
      mode: "api",
      version: "1.2.3",
      authProvider: "mock",
      features: { auth: true, ingest: true, snapshots: true, sharedReports: true },
    })
  })
})

describe("GET /api/dataset", () => {
  it("serves the current dataset's exact text, tagged with its ingest", async () => {
    const { app, store } = await make()
    const cookie = await signIn(app)
    const current = (await store.current())!
    const res = await app.inject({ url: "/api/dataset", headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(res.headers["content-type"]).toContain("application/json")
    expect(res.headers.etag).toBe(`"${current.ingest.id}"`)
    expect(res.headers["x-ingest-id"]).toBe(current.ingest.id)
    expect(res.body).toBe(current.json)
  })

  it("answers 304 when the browser already has that ingest", async () => {
    const { app } = await make()
    const cookie = await signIn(app)
    const first = await app.inject({ url: "/api/dataset", headers: { cookie } })
    const again = await app.inject({ url: "/api/dataset", headers: { cookie, "if-none-match": first.headers.etag as string } })
    expect(again.statusCode).toBe(304)
    expect(again.body).toBe("")
  })

  it("is a readable 404 before any data arrives", async () => {
    const { app } = await make({ seed: false })
    const res = await app.inject({ url: "/api/dataset", headers: { cookie: await signIn(app) } })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toMatch(/No data yet/)
  })
})

describe("BASE_PATH and CORS", () => {
  it("serves every route under the sub-path, and nothing at the root", async () => {
    const { app } = await make({ basePath: "/dash" })
    expect((await app.inject({ url: "/dash/api/health" })).statusCode).toBe(200)
    expect((await app.inject({ url: "/api/health" })).statusCode).toBe(404)
  })

  it("allows the configured origin and exposes the ingest headers", async () => {
    const { app } = await make()
    const ok = await app.inject({ url: "/api/health", headers: { origin: "http://localhost:5173" } })
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173")
    expect(ok.headers["access-control-expose-headers"]).toContain("X-Ingest-Id")
    const other = await app.inject({ url: "/api/health", headers: { origin: "https://elsewhere.example" } })
    expect(other.headers["access-control-allow-origin"]).toBeUndefined()
  })
})
