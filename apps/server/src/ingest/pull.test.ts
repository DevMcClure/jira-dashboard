import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gzipSync } from "node:zlib"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createMemoryDatasetStore } from "../dataset-store"
import { CONTRACT_JSON, NOT_AN_EXPORT, TRAWLER_JSON } from "../testkit"
import { createIngestPipeline } from "./pipeline"
import { createPuller, pullSourceLabel, schedulePull } from "./pull"

const quiet = { info: () => {}, warn: () => {}, error: () => {} }
const setup = (env: { TRAWLER_PULL_URL?: string; TRAWLER_PULL_PATH?: string; INGEST_MAX_MB?: number }) => {
  const store = createMemoryDatasetStore()
  const pipeline = createIngestPipeline({ store, log: quiet })
  const puller = createPuller({ pipeline, env: { INGEST_MAX_MB: 50, ...env }, log: quiet, timeoutMs: 2000 })
  return { store, puller }
}

describe("pull from TRAWLER_PULL_PATH", () => {
  const dir = mkdtempSync(join(tmpdir(), "pull-test-"))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it("ingests the file, skips it while unchanged, and picks up a change", async () => {
    const path = join(dir, "latest.json")
    writeFileSync(path, CONTRACT_JSON)
    const { store, puller } = setup({ TRAWLER_PULL_PATH: path })
    expect(await puller.run()).toMatchObject({ status: "ingested" })
    expect(await puller.run()).toMatchObject({ status: "unchanged" })
    expect(store.ingests).toHaveLength(1)
    writeFileSync(path, TRAWLER_JSON)
    expect(await puller.run()).toMatchObject({ status: "ingested" })
    expect(store.ingests.map((i) => [i.source, i.status])).toEqual([["pull", "superseded"], ["pull", "current"]])
  })

  it("reads a gzipped file", async () => {
    const path = join(dir, "latest.json.gz")
    writeFileSync(path, gzipSync(CONTRACT_JSON))
    const { store, puller } = setup({ TRAWLER_PULL_PATH: path })
    expect(await puller.run()).toMatchObject({ status: "ingested" })
    expect((await store.current())?.json).toBe(CONTRACT_JSON)
  })

  it("keeps the current data when the file is missing, too big or invalid", async () => {
    const path = join(dir, "data.json")
    writeFileSync(path, CONTRACT_JSON)
    const { store, puller } = setup({ TRAWLER_PULL_PATH: path, INGEST_MAX_MB: 0.002 }) // ~2 KB; the export is ~3 KB
    expect(await puller.run()).toMatchObject({ status: "failed", error: expect.stringMatching(/INGEST_MAX_MB/) })
    expect(await setup({ TRAWLER_PULL_PATH: join(dir, "nope.json") }).puller.run()).toMatchObject({ status: "failed" })

    const ok = setup({ TRAWLER_PULL_PATH: path })
    await ok.puller.run()
    writeFileSync(path, NOT_AN_EXPORT)
    expect(await ok.puller.run()).toMatchObject({ status: "rejected", problems: expect.any(Array) })
    expect((await ok.store.current())?.json).toBe(CONTRACT_JSON)
    expect(store.ingests).toHaveLength(0)
  })
})

describe("pull from TRAWLER_PULL_URL", () => {
  let server: Server
  let base = ""
  let body: string | Buffer = CONTRACT_JSON
  let status = 200
  let headers: Record<string, string> = {}
  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(status, { "content-type": "application/json", ...headers })
      res.end(body)
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise((resolve) => server.close(resolve)))

  it("fetches the export, including one sent with Content-Encoding: gzip", async () => {
    const { store, puller } = setup({ TRAWLER_PULL_URL: `${base}/latest.json` })
    expect(await puller.run()).toMatchObject({ status: "ingested" })
    ;[body, headers] = [gzipSync(TRAWLER_JSON), { "content-encoding": "gzip" }]
    expect(await puller.run()).toMatchObject({ status: "ingested" })
    expect((await store.current())?.json).toBe(TRAWLER_JSON)
    ;[body, headers] = [CONTRACT_JSON, {}]
  })

  it("keeps the current data when the server errors", async () => {
    const { store, puller } = setup({ TRAWLER_PULL_URL: `${base}/latest.json` })
    await puller.run()
    status = 503
    expect(await puller.run()).toMatchObject({ status: "failed", error: expect.stringMatching(/503/) })
    status = 200
    expect(store.ingests).toHaveLength(1)
  })

  it("says why it couldn't connect", async () => {
    const probe = createServer()
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve))
    const { port } = probe.address() as AddressInfo
    await new Promise((resolve) => probe.close(resolve))
    expect(await setup({ TRAWLER_PULL_URL: `http://127.0.0.1:${port}/x.json` }).puller.run()).toEqual({ status: "failed", error: "fetch failed (ECONNREFUSED)" })
  })
})

describe("pullSourceLabel / schedulePull", () => {
  it("never logs credentials or a query string", () => {
    expect(pullSourceLabel({ TRAWLER_PULL_URL: "https://user:secret@files.example.com/trawl/latest.json?sig=abc" })).toBe("https://files.example.com/trawl/latest.json")
    expect(pullSourceLabel({ TRAWLER_PULL_PATH: "/data/latest.json" })).toBe("/data/latest.json")
  })

  it("runs once straight away, then on the schedule", async () => {
    let runs = 0
    const job = schedulePull("0 0 1 1 *", async () => void runs++)
    expect(runs).toBe(1)
    expect(job.nextRun()?.getMonth()).toBe(0)
    job.stop()
  })
})
