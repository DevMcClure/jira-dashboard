/**
 * Runs against a real MongoDB only when MONGO_TEST_URI is set (CI skips it).
 * Uses a throwaway database name and drops it afterwards.
 */
import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, it } from "vitest"
import { createMongoAuthStore } from "./auth/auth-store"
import { createMongoDatasetStore } from "./dataset-store"
import { collections, connect, ensureIndexes } from "./db"
import { SAMPLE_JSON, seedIfEmpty } from "./seed"

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

    const next = await store.insertCurrent({ json: "{}", source: "upload", generatedAt: null, counts: { teams: 0, people: 0, sprints: 0, issues: 0 } })
    expect((await store.current())?.ingest.id).toBe(next.id)
    const statuses = await collections(db).ingests.find({}, { projection: { status: 1 } }).toArray()
    expect(statuses.map((s) => s.status).sort()).toEqual(["current", "superseded"])
  })

  it("refuses a second current ingest at the database level", async () => {
    const { db } = await open()
    const { ingests } = collections(db)
    await expect(
      ingests.insertOne({ _id: randomUUID(), receivedAt: new Date(), source: "push", generatedAt: null, counts: { teams: 0, people: 0, sprints: 0, issues: 0 }, status: "current", datasetId: "x" }),
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
})
