/**
 * MongoDB connection and indexes. Works with any MongoDB: the connection string,
 * database name and optional TLS CA file all come from env (env.ts).
 */
import type { FlowConfig } from "@jira-dashboard/core/flowConfig"
import type { ReportConfig } from "@jira-dashboard/core/report-config"
import type { Snapshot } from "@jira-dashboard/core/snapshot"
import { GridFSBucket, MongoClient, type Db, type ObjectId } from "mongodb"
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
    snapshots: db.collection<SnapshotDoc>("daily_snapshots"),
    reports: db.collection<ReportDoc>("reports"),
    reportReads: db.collection<ReportReadDoc>("report_reads"),
    settings: db.collection<SettingsDoc>("settings"),
  }
}

/** Dataset texts too large for one document (over ~15 MB) live here. */
export const datasetFiles = (db: Db) => new GridFSBucket(db, { bucketName: "dataset_files" })

/** Idempotent: safe on every startup. */
export async function ensureIndexes(db: Db) {
  const { ingests, datasets, sessions, users, snapshots, reports, reportReads } = collections(db)
  await ingests.createIndex({ receivedAt: -1 }, { name: "receivedAt_desc" })
  // At most one current dataset at a time.
  await ingests.createIndex({ status: 1 }, { name: "one_current", unique: true, partialFilterExpression: { status: "current" } })
  await datasets.createIndex({ ingestId: 1 }, { name: "ingestId" })
  // Mongo deletes a session once its expiresAt has passed.
  await sessions.createIndex({ expiresAt: 1 }, { name: "expiresAt_ttl", expireAfterSeconds: 0 })
  await users.createIndex({ email: 1 }, { name: "email" })
  // One snapshot per team per day; history by team, sprint or PI.
  await snapshots.createIndex({ teamId: 1, date: 1 }, { name: "team_date", unique: true })
  await snapshots.createIndex({ "sprint.id": 1, date: 1 }, { name: "sprint_date" })
  await snapshots.createIndex({ "pi.id": 1, date: 1 }, { name: "pi_date" })
  // Created by me / shared with me (by user or group), and which frozen reports pin an ingest.
  await reports.createIndex({ ownerId: 1 }, { name: "owner" })
  await reports.createIndex({ "recipients.users.id": 1 }, { name: "recipient_users" })
  await reports.createIndex({ "recipients.groups": 1 }, { name: "recipient_groups" })
  await reports.createIndex({ "frozen.ingestId": 1 }, { name: "frozen_ingest", sparse: true })
  await reportReads.createIndex({ reportId: 1, userId: 1 }, { name: "report_user", unique: true })
}

export type IngestSource = "seed" | "push" | "pull" | "upload"
export type IngestStatus = "current" | "superseded" | "rejected"

/** One Trawler run, published upload or seed; also kept when it was rejected. */
export type IngestDoc = {
  _id: string
  receivedAt: Date
  source: IngestSource
  generatedAt: Date | null
  counts: { teams: number; people: number; sprints: number; issues: number }
  status: IngestStatus
  /** Why it was rejected (the first 50 problems). */
  errors?: string[]
  /** Its text; null when rejected, or once retention has removed the text. */
  datasetId: string | null
  /** SHA-256 of the text, hex. */
  sha256: string
  bytes: number
  /** Published uploads: who and which file. */
  uploadedBy?: string
  fileName?: string
}

/** The exact text of one ingest (contract JSON, raw Trawler JSON or an audit log): inline, or in GridFS when large. */
export type DatasetDoc = {
  _id: string
  ingestId: string
  json?: string
  fileId?: ObjectId
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

/** One team on one day (core's `snapshotSchema`), plus a hash of its content for idempotent reruns. */
export type SnapshotDoc = Snapshot & { hash: string }

/** A person a report is shared with; the name is kept from when it was shared, for people who haven't signed in yet. */
export type Recipient = { id: string; displayName: string }

/** A saved report (B5): the frontend's `ReportConfig`, an owner and who it's shared with. */
export type ReportDoc = {
  _id: string
  ownerId: string
  config: ReportConfig
  recipients: { users: Recipient[]; groups: string[] }
  /** Frozen reports: the ingest whose data they show (kept by retention while pinned). */
  frozen?: { ingestId: string }
  createdAt: Date
  updatedAt: Date
}

/** When a person last opened a report (for "unread" in Shared with me). */
export type ReportReadDoc = { reportId: string; userId: string; lastReadAt: Date }

/** Shared settings, one document each; so far only `flow` (the flow metric settings, edited by admins). */
export type SettingsDoc = { _id: "flow"; config: FlowConfig; updatedAt: Date; updatedBy: string }
