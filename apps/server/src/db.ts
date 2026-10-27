/**
 * MongoDB connection and indexes. Works with any MongoDB: the connection string,
 * database name and optional TLS CA file all come from env (env.ts).
 */
import { MongoClient, type Db } from "mongodb"
import type { Env } from "./env"

export type Collections = ReturnType<typeof collections>

export async function connect(env: Pick<Env, "MONGO_URI" | "MONGO_DB_NAME" | "MONGO_TLS_CA_FILE">) {
  const client = new MongoClient(env.MONGO_URI, {
    appName: "jira-dashboard",
    serverSelectionTimeoutMS: 10_000,
    ...(env.MONGO_TLS_CA_FILE ? { tls: true, tlsCAFile: env.MONGO_TLS_CA_FILE } : {}),
  })
  await client.connect()
  return { client, db: client.db(env.MONGO_DB_NAME) }
}

/** The collections in use so far (the rest of the data model arrives with later phases). */
export function collections(db: Db) {
  return {
    ingests: db.collection<IngestDoc>("ingests"),
    datasets: db.collection<DatasetDoc>("datasets"),
    sessions: db.collection<SessionDoc>("sessions"),
    users: db.collection<UserDoc>("users"),
  }
}

/** Idempotent: safe on every startup. */
export async function ensureIndexes(db: Db) {
  const { ingests, datasets, sessions, users } = collections(db)
  await ingests.createIndex({ receivedAt: -1 }, { name: "receivedAt_desc" })
  // At most one current dataset at a time.
  await ingests.createIndex({ status: 1 }, { name: "one_current", unique: true, partialFilterExpression: { status: "current" } })
  await datasets.createIndex({ ingestId: 1 }, { name: "ingestId" })
  // Mongo deletes a session once its expiresAt has passed.
  await sessions.createIndex({ expiresAt: 1 }, { name: "expiresAt_ttl", expireAfterSeconds: 0 })
  await users.createIndex({ email: 1 }, { name: "email" })
}

export type IngestSource = "seed" | "push" | "pull" | "upload"
export type IngestStatus = "current" | "superseded" | "rejected"

/** One Trawler run, upload or seed. */
export type IngestDoc = {
  _id: string
  receivedAt: Date
  source: IngestSource
  generatedAt: Date | null
  counts: { teams: number; people: number; sprints: number; issues: number }
  status: IngestStatus
  errors?: string[]
  datasetId: string
}

/** The exact JSON text of one ingest (contract or raw Trawler shape). */
export type DatasetDoc = {
  _id: string
  ingestId: string
  json: string
}

/** One signed-in browser. The provider token is encrypted (auth/crypto.ts). */
export type SessionDoc = {
  _id: string
  userId: string
  roles: ("viewer" | "author" | "admin")[]
  crowdToken: string | null
  expiresAt: Date
  lastValidatedAt: Date
  createdAt: Date
}

/** A cache of people who have signed in (for names in the UI and, later, sharing). */
export type UserDoc = {
  _id: string
  displayName: string
  email: string | null
  groups: string[]
  lastSeenAt: Date
}
