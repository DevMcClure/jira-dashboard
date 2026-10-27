/**
 * Runs against a real MongoDB only when MONGO_TEST_URI is set (CI skips it).
 * Uses a throwaway database name and drops it afterwards.
 */
import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, it } from "vitest"
import { createMongoAuthStore } from "./auth/auth-store"
import { createMongoDatasetStore } from "./dataset-store"
import { collections, connect, datasetFiles, ensureIndexes } from "./db"
import { sha256 } from "./ingest/pipeline"
import { createMongoReportStore } from "./reports/store"
import { createSnapshotJob } from "./snapshots/job"
import { createMongoSnapshotStore } from "./snapshots/store"
import { SAMPLE_JSON, seedIfEmpty } from "./seed"
import { CONTRACT_JSON } from "./testkit"

const uri = process.env.MONGO_TEST_URI

describe.skipIf(!uri)("MongoDB stores", () => {
  const dbName = `jira_dashboard_test_${randomUUID().slice(0, 8)}`
  const opened: Awaited<ReturnType<typeof connect>>[] = []
  const open = async () => {
    const c = await connect({ MONGO_URI: uri!, MONGO_DB_NAME: dbName, MONGO_TLS_CA_FILE: undefined })
    opened.push(c)
    return c
  }
  afterAll(async () => {
    await opened[0]?.db.dropDatabase()
    await Promise.all(opened.map((c) => c.client.close()))
  })

  it("creates the data model's indexes, idempotently", async () => {
    const { db } = await open()
    await ensureIndexes(db)
    await ensureIndexes(db)
    const { ingests, sessions, users } = collections(db)
    expect((await ingests.indexes()).map((i) => i.name)).toEqual(expect.arrayContaining(["receivedAt_desc", "one_current"]))
    const ttl = (await sessions.indexes()).find((i) => i.name === "expiresAt_ttl")
    expect(ttl).toMatchObject({ key: { expiresAt: 1 }, expireAfterSeconds: 0 })
    expect((await users.indexes()).map((i) => i.name)).toContain("email")
  })

  it("seeds once, then a new dataset supersedes the old one", async () => {
    const { db } = await open()
    const store = createMongoDatasetStore(db)
    const seeded = await seedIfEmpty(store)
    expect(seeded).not.toBeNull()
    expect(await seedIfEmpty(store)).toBeNull()
    expect((await store.current())?.json).toBe(SAMPLE_JSON)

    const next = await store.insertCurrent({ json: "{}", source: "upload", generatedAt: null, counts: { teams: 0, people: 0, sprints: 0, issues: 0 }, sha256: sha256("{}"), bytes: 2 })
    expect((await store.current())?.ingest.id).toBe(next.id)
    const statuses = await collections(db).ingests.find({}, { projection: { status: 1 } }).toArray()
    expect(statuses.map((s) => s.status).sort()).toEqual(["current", "superseded"])
  })

  it("refuses a second current ingest at the database level", async () => {
    const { db } = await open()
    const { ingests } = collections(db)
    await expect(
      ingests.insertOne({ _id: randomUUID(), receivedAt: new Date(), source: "push", generatedAt: null, counts: { teams: 0, people: 0, sprints: 0, issues: 0 }, status: "current", datasetId: "x", sha256: "", bytes: 0 }),
    ).rejects.toThrow(/duplicate key/)
  })

  it("finds the same current dataset after reconnecting", async () => {
    const { db } = await open()
    const current = await createMongoDatasetStore(db).current()
    expect(current?.json).toBe("{}")
  })

  it("keeps sessions and the user cache", async () => {
    const { db } = await open()
    const store = createMongoAuthStore(db)
    const at = new Date("2026-03-02T09:00:00Z")
    await store.upsertUser({ id: "sam.scrum", displayName: "Sam Rivers", email: "sam@example.com", groups: ["a"] }, at)
    await store.upsertUser({ id: "sam.scrum", displayName: "Sam Rivers", email: "sam@example.com", groups: ["b"] }, at)
    expect(await store.getUser("sam.scrum")).toEqual({ _id: "sam.scrum", displayName: "Sam Rivers", email: "sam@example.com", groups: ["b"], lastSeenAt: at })
    expect(await collections(db).users.countDocuments()).toBe(1)

    const session = { _id: "s1", userId: "sam.scrum", roles: ["viewer" as const], crowdToken: "v1.sealed", expiresAt: new Date(at.getTime() + 3_600_000), lastValidatedAt: at, createdAt: at }
    await store.createSession(session)
    expect(await store.getSession("s1")).toEqual(session)
    const later = new Date(at.getTime() + 60_000)
    await store.updateSession("s1", { roles: ["author", "viewer"], lastValidatedAt: later })
    expect(await store.getSession("s1")).toMatchObject({ roles: ["author", "viewer"], lastValidatedAt: later, crowdToken: "v1.sealed" })
    await store.deleteSession("s1")
    expect(await store.getSession("s1")).toBeNull()
  })

  it("keeps large texts in GridFS and returns them byte for byte", async () => {
    const { db } = await open()
    const store = createMongoDatasetStore(db, { inlineLimitBytes: 1000 })
    const text = `${CONTRACT_JSON}\n${"é".repeat(600)}` // over the limit, with multi-byte characters
    const ingest = await store.insertCurrent({ json: text, source: "push", generatedAt: null, counts: { teams: 1, people: 0, sprints: 0, issues: 3 }, sha256: sha256(text), bytes: Buffer.byteLength(text) })
    const doc = await collections(db).datasets.findOne({ _id: ingest.datasetId! })
    expect(doc?.json).toBeUndefined()
    expect(doc?.fileId).toBeDefined()
    expect((await store.current())?.json).toBe(text)
    expect((await store.meta())?.id).toBe(ingest.id)
  })

  it("records rejected ingests without touching the current one", async () => {
    const { db } = await open()
    const store = createMongoDatasetStore(db)
    const before = (await store.meta())!.id
    const rejected = await store.recordRejected({ source: "push", sha256: "abc", bytes: 3, errors: ["issues: Required"] })
    expect(await collections(db).ingests.findOne({ _id: rejected.id })).toMatchObject({ status: "rejected", datasetId: null, errors: ["issues: Required"] })
    expect((await store.meta())!.id).toBe(before)
  })

  it("prunes old texts, GridFS files included, and keeps every ingest record", async () => {
    const { db } = await open()
    const store = createMongoDatasetStore(db, { inlineLimitBytes: 1000 })
    for (let i = 0; i < 3; i++) {
      const text = `${CONTRACT_JSON}${" ".repeat(1000 + i)}`
      await store.insertCurrent({ json: text, source: "push", generatedAt: null, counts: { teams: 1, people: 0, sprints: 0, issues: 3 }, sha256: sha256(text), bytes: text.length })
    }
    const { ingests, datasets } = collections(db)
    const records = await ingests.countDocuments()
    await store.prune(2)
    expect(await datasets.countDocuments()).toBe(2)
    expect(await datasetFiles(db).find().toArray()).toHaveLength(2)
    expect(await ingests.countDocuments()).toBe(records)
    expect(await ingests.countDocuments({ datasetId: { $ne: null } })).toBe(2)
    expect((await store.current())?.json).toMatch(/^\{/)
  })

  it("stores one snapshot per team per day, idempotently", async () => {
    const { db } = await open()
    await ensureIndexes(db)
    const { snapshots } = collections(db)
    expect((await snapshots.indexes()).map((i) => i.name)).toEqual(expect.arrayContaining(["team_date", "sprint_date", "pi_date"]))

    const datasets = createMongoDatasetStore(db)
    await datasets.insertCurrent({ json: SAMPLE_JSON, source: "seed", generatedAt: new Date("2026-10-19T17:00:00Z"), counts: { teams: 3, people: 0, sprints: 0, issues: 0 }, sha256: sha256(SAMPLE_JSON), bytes: SAMPLE_JSON.length })
    const store = createMongoSnapshotStore(db)
    const job = createSnapshotJob({ datasets, snapshots: store, log: { info: () => {}, warn: () => {} } })

    const first = await job.run(["2026-10-14"])
    expect("teams" in first[0] && first[0].teams.map((t) => t.result)).toEqual(["written", "written", "written"])
    const takenAt = (await store.get("TEAM-PLAT", "2026-10-14"))!.takenAt
    const again = await job.run(["2026-10-14"])
    expect("teams" in again[0] && again[0].teams.map((t) => t.result)).toEqual(["unchanged", "unchanged", "unchanged"])
    expect(await snapshots.countDocuments()).toBe(3)
    expect((await store.get("TEAM-PLAT", "2026-10-14"))!.takenAt).toBe(takenAt)

    const kept = await job.run(["2026-10-14"], { backfilled: true })
    expect("teams" in kept[0] && kept[0].teams.map((t) => t.result)).toEqual(["kept", "kept", "kept"])

    await job.run(["2026-10-13"], { backfilled: true })
    const list = await store.list("TEAM-PLAT", "2026-10-01", "2026-10-31")
    expect(list.map((s) => [s.date, s.backfilled])).toEqual([["2026-10-13", true], ["2026-10-14", false]])
    expect(list[0]).not.toHaveProperty("issues")
    expect(list[0]).not.toHaveProperty("hash")
    expect(list[0]).not.toHaveProperty("_id")
    await expect(snapshots.insertOne({ ...(await snapshots.findOne({ teamId: "TEAM-PLAT", date: "2026-10-13" }, { projection: { _id: 0 } }))! })).rejects.toThrow(/duplicate key/)
  })

  it("stores reports, finds those shared by user or group, tracks reads, and pins frozen data", async () => {
    const { db } = await open()
    await ensureIndexes(db)
    const { reports: reportsCol, reportReads } = collections(db)
    expect((await reportsCol.indexes()).map((i) => i.name)).toEqual(expect.arrayContaining(["owner", "recipient_users", "recipient_groups", "frozen_ingest"]))
    expect((await reportReads.indexes()).map((i) => i.name)).toContain("report_user")

    const reports = createMongoReportStore(db)
    const config = { title: "R" } as never
    const at = new Date("2026-10-20T09:00:00Z")
    const direct = await reports.create({ ownerId: "sam", config, recipients: { users: [{ id: "morgan", displayName: "Morgan" }], groups: [] } }, at)
    const byGroup = await reports.create({ ownerId: "ada", config, recipients: { users: [], groups: ["authors"] }, frozen: { ingestId: "ing-pinned" } }, new Date(at.getTime() + 1000))
    await reports.create({ ownerId: "ada", config, recipients: { users: [], groups: [] } }, at)

    expect((await reports.listSharedWith("morgan", [])).map((r) => r._id)).toEqual([direct._id])
    expect((await reports.listSharedWith("sam", ["authors"])).map((r) => r._id)).toEqual([byGroup._id])
    expect((await reports.listSharedWith("ada", ["authors"])).map((r) => r._id)).toEqual([]) // not your own
    expect((await reports.listOwned("ada")).map((r) => r._id)[0]).toBe(byGroup._id) // newest first
    expect(await reports.pinnedIngestIds()).toEqual(["ing-pinned"])

    await reports.markRead(direct._id, "morgan", at)
    await reports.markRead(direct._id, "morgan", new Date(at.getTime() + 5000))
    expect(await reportReads.countDocuments({ reportId: direct._id })).toBe(1)
    expect((await reports.lastReads("morgan", [direct._id])).get(direct._id)).toEqual(new Date(at.getTime() + 5000))

    const updated = await reports.update(byGroup._id, { frozen: null }, new Date(at.getTime() + 9000))
    expect(updated?.frozen).toBeUndefined()
    expect(await reports.pinnedIngestIds()).toEqual([])
    await reports.delete(direct._id)
    expect(await reportReads.countDocuments({ reportId: direct._id })).toBe(0)
  })

  it("never prunes the data of a pinned ingest", async () => {
    const { db } = await open()
    const store = createMongoDatasetStore(db)
    const add = (n: number) => store.insertCurrent({ json: `${CONTRACT_JSON}${" ".repeat(n)}`, source: "push", generatedAt: null, counts: { teams: 1, people: 0, sprints: 0, issues: 3 }, sha256: String(n), bytes: 1 })
    const pinned = await add(100)
    for (let i = 1; i <= 4; i++) await add(100 + i)
    await store.prune(2, [pinned.id])
    expect((await store.byIngest(pinned.id))?.json).toBe(`${CONTRACT_JSON}${" ".repeat(100)}`)
    expect(await collections(db).ingests.countDocuments({ datasetId: { $ne: null }, sha256: { $in: ["100", "101", "102", "103", "104"] } })).toBe(3) // newest 2 + pinned
  })
})
