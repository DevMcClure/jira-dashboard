import { gzipSync } from "node:zlib"
import { afterEach, describe, expect, it } from "vitest"
import { CONTRACT_JSON, makeApp, NOT_AN_EXPORT, signIn, TRAWLER_LOG } from "../testkit"
import { INGEST_REQUESTS_PER_MINUTE } from "./routes"

const TOKEN = "test-ingest-token-that-is-long-enough"
const apps: Awaited<ReturnType<typeof makeApp>>["app"][] = []
const make = async (env: Record<string, string> = { INGEST_TOKEN: TOKEN }, seed = true) => {
  const made = await makeApp({ env, seed })
  apps.push(made.app)
  return made
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
})

type App = Awaited<ReturnType<typeof make>>["app"]
const push = (app: App, payload: string | Buffer, headers: Record<string, string> = {}) =>
  app.inject({ method: "POST", url: "/api/ingest", payload, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...headers } })

describe("POST /api/ingest", () => {
  it("makes a pushed export current, kept byte for byte", async () => {
    const { app } = await make()
    const res = await push(app, CONTRACT_JSON)
    expect(res.statusCode).toBe(201)
    const { ingest } = res.json()
    expect(ingest).toMatchObject({ source: "push", counts: { teams: 1, issues: 3 } })
    expect(Object.keys(ingest).sort()).toEqual(["counts", "generatedAt", "id", "receivedAt", "source"])

    const cookie = await signIn(app)
    const dataset = await app.inject({ url: "/api/dataset", headers: { cookie } })
    expect(dataset.body).toBe(CONTRACT_JSON)
    expect(dataset.headers["x-ingest-id"]).toBe(ingest.id)
    expect(dataset.headers["x-ingest-source"]).toBe("push")
  })

  it("needs the bearer token, and is off without INGEST_TOKEN", async () => {
    const { app, store } = await make()
    const before = (await store.meta())!.id
    for (const authorization of ["", "Bearer nope", `Basic ${TOKEN}`, `Bearer ${TOKEN}x`]) {
      const res = await push(app, CONTRACT_JSON, { authorization })
      expect(res.statusCode).toBe(401)
      expect(res.headers["www-authenticate"]).toBe('Bearer realm="ingest"')
    }
    expect((await store.meta())!.id).toBe(before)

    const { app: off } = await make({})
    const res = await push(off, CONTRACT_JSON)
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toMatch(/INGEST_TOKEN/)
  })

  it("accepts the audit log as plain text, and any or no content type", async () => {
    const { app } = await make()
    expect((await push(app, TRAWLER_LOG, { "content-type": "text/plain" })).statusCode).toBe(201)
    expect((await push(app, CONTRACT_JSON, { "content-type": "application/octet-stream" })).statusCode).toBe(201)
    const bare = await app.inject({ method: "POST", url: "/api/ingest", payload: CONTRACT_JSON, headers: { authorization: `Bearer ${TOKEN}` } })
    expect(bare.statusCode).toBe(201)
  })

  it("inflates gzip, by header or by its magic bytes", async () => {
    const { app } = await make()
    const gz = gzipSync(CONTRACT_JSON)
    expect((await push(app, gz, { "content-encoding": "gzip" })).statusCode).toBe(201)
    expect((await push(app, gz, { "content-type": "application/gzip" })).statusCode).toBe(201)
    expect((await push(app, Buffer.from([0x1f, 0x8b, 8, 0, 1, 2, 3]), { "content-encoding": "gzip" })).json()).toEqual({ error: "The body isn't valid gzip." })
    expect((await push(app, CONTRACT_JSON, { "content-encoding": "br" })).statusCode).toBe(415)
  })

  it("caps the body at INGEST_MAX_MB, compressed and inflated", async () => {
    const { app, store } = await make({ INGEST_TOKEN: TOKEN, INGEST_MAX_MB: "0.01" }) // ~10 KB
    const before = (await store.meta())!.id
    const big = `${CONTRACT_JSON}${" ".repeat(20_000)}`
    const direct = await push(app, big)
    expect(direct.statusCode).toBe(413)
    expect(direct.json().error).toMatch(/INGEST_MAX_MB/)
    const bomb = await push(app, gzipSync(big), { "content-encoding": "gzip" })
    expect(bomb.statusCode).toBe(413)
    expect((await store.meta())!.id).toBe(before)
  })

  it("rejects an invalid export with readable problems, keeping the current data", async () => {
    const { app, store } = await make()
    const before = (await store.current())!
    const res = await push(app, NOT_AN_EXPORT)
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: expect.stringMatching(/current data is unchanged/), problems: expect.arrayContaining([expect.stringMatching(/^issues\.0\.key: /)]) })
    expect((await store.current())!.ingest.id).toBe(before.ingest.id)
    expect(store.ingests.at(-1)).toMatchObject({ status: "rejected", source: "push" })
    expect((await push(app, "")).statusCode).toBe(400)
  })

  it(`allows ${INGEST_REQUESTS_PER_MINUTE} requests a minute`, async () => {
    const { app } = await make()
    for (let i = 0; i < INGEST_REQUESTS_PER_MINUTE; i++) await push(app, "{}", { authorization: "Bearer wrong" })
    expect((await push(app, CONTRACT_JSON)).statusCode).toBe(429)
  })
})

describe("POST /api/ingest/upload", () => {
  const upload = (app: App, cookie: string | undefined, payload: unknown, contentType = "application/json") =>
    app.inject({
      method: "POST",
      url: "/api/ingest/upload",
      payload: typeof payload === "string" ? payload : JSON.stringify(payload),
      headers: { "content-type": contentType, ...(cookie ? { cookie } : {}) },
    })

  it("lets admins publish a file, recording who", async () => {
    const { app, store } = await make({})
    const cookie = await signIn(app, "ada.admin")
    const res = await upload(app, cookie, { fileName: "trawl.json", text: CONTRACT_JSON })
    expect(res.statusCode).toBe(201)
    expect(res.json().ingest).toMatchObject({ source: "upload", counts: { issues: 3 } })
    expect(await store.meta()).toMatchObject({ source: "upload", uploadedBy: "ada.admin", fileName: "trawl.json" })
  })

  it("is for signed-in admins only", async () => {
    const { app, store } = await make({})
    const before = (await store.meta())!.id
    expect((await upload(app, undefined, { fileName: "x.json", text: CONTRACT_JSON })).statusCode).toBe(401)
    for (const persona of ["sam.scrum", "morgan.manager"]) {
      const res = await upload(app, await signIn(app, persona), { fileName: "x.json", text: CONTRACT_JSON })
      expect(res.statusCode).toBe(403)
    }
    expect((await store.meta())!.id).toBe(before)
  })

  it("takes JSON only, and reports an invalid export", async () => {
    const { app } = await make({})
    const cookie = await signIn(app, "ada.admin")
    expect((await upload(app, cookie, CONTRACT_JSON, "text/plain")).statusCode).toBe(415)
    expect((await upload(app, cookie, { fileName: "x.json" })).statusCode).toBe(400)
    const bad = await upload(app, cookie, { fileName: "x.json", text: NOT_AN_EXPORT })
    expect(bad.statusCode).toBe(422)
    expect(bad.json().problems.length).toBeGreaterThan(0)
  })
})

describe("GET /api/dataset/meta", () => {
  it("describes the current ingest without its data", async () => {
    const { app, store } = await make()
    expect((await app.inject({ url: "/api/dataset/meta" })).statusCode).toBe(401)
    const cookie = await signIn(app)
    const res = await app.inject({ url: "/api/dataset/meta", headers: { cookie } })
    const current = (await store.meta())!
    expect(res.headers["cache-control"]).toBe("no-store")
    expect(res.json()).toEqual({
      ingestId: current.id,
      source: "seed",
      receivedAt: current.receivedAt.toISOString(),
      generatedAt: current.generatedAt!.toISOString(),
      counts: current.counts,
    })
  })

  it("is 404 before any data", async () => {
    const { app } = await make({}, false)
    const cookie = await signIn(app)
    expect((await app.inject({ url: "/api/dataset/meta", headers: { cookie } })).statusCode).toBe(404)
  })
})
