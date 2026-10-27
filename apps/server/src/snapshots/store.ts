/**
 * Where daily snapshots live: MongoDB in the server, memory in tests. Saving
 * is idempotent: a snapshot with the same content as the stored one (apart
 * from when it was taken) isn't written again.
 */
import { createHash } from "node:crypto"
import type { Snapshot, SnapshotSummary } from "@jira-dashboard/core/snapshot"
import type { Db } from "mongodb"
import { collections, type SnapshotDoc } from "../db"

/**
 * - written: stored (new, or the content changed)
 * - unchanged: the same content was already there
 * - kept: a backfill didn't replace a snapshot taken on the day (use force)
 */
export type SaveResult = "written" | "unchanged" | "kept"

export interface SnapshotStore {
  save(snapshot: Snapshot, opts?: { force?: boolean }): Promise<SaveResult>
  /** One team's days in [from, to], oldest first, without `issues`. */
  list(teamId: string, from: string, to: string): Promise<SnapshotSummary[]>
  get(teamId: string, date: string): Promise<Snapshot | null>
}

/** SHA-256 of everything except `takenAt`. */
export function contentHash(snapshot: Snapshot): string {
  const { takenAt: _takenAt, ...content } = snapshot
  return createHash("sha256").update(JSON.stringify(content)).digest("hex")
}

/** The decision both stores make before writing. */
function verdict(snapshot: Snapshot, hash: string, existing: Pick<SnapshotDoc, "hash" | "backfilled"> | null, force: boolean): SaveResult | null {
  if (existing?.hash === hash) return "unchanged"
  if (existing && snapshot.backfilled && !existing.backfilled && !force) return "kept"
  return null
}

const withoutInternals = <T extends { hash?: string }>({ hash: _hash, ...rest }: T) => rest

export function createMongoSnapshotStore(db: Db): SnapshotStore {
  const { snapshots } = collections(db)
  return {
    async save(snapshot, { force = false } = {}) {
      const hash = contentHash(snapshot)
      const existing = await snapshots.findOne({ teamId: snapshot.teamId, date: snapshot.date }, { projection: { hash: 1, backfilled: 1 } })
      const skip = verdict(snapshot, hash, existing, force)
      if (skip) return skip
      await snapshots.replaceOne({ teamId: snapshot.teamId, date: snapshot.date }, { ...snapshot, hash }, { upsert: true })
      return "written"
    },
    async list(teamId, from, to) {
      const docs = await snapshots
        .find({ teamId, date: { $gte: from, $lte: to } }, { projection: { _id: 0, hash: 0, issues: 0 } })
        .sort({ date: 1 })
        .toArray()
      return docs as SnapshotSummary[]
    },
    async get(teamId, date) {
      const doc = await snapshots.findOne({ teamId, date }, { projection: { _id: 0 } })
      return doc ? withoutInternals(doc) : null
    },
  }
}

export function createMemorySnapshotStore(): SnapshotStore & { docs: Map<string, SnapshotDoc> } {
  const docs = new Map<string, SnapshotDoc>()
  const key = (teamId: string, date: string) => `${teamId}|${date}`
  return {
    docs,
    async save(snapshot, { force = false } = {}) {
      const hash = contentHash(snapshot)
      const skip = verdict(snapshot, hash, docs.get(key(snapshot.teamId, snapshot.date)) ?? null, force)
      if (skip) return skip
      docs.set(key(snapshot.teamId, snapshot.date), structuredClone({ ...snapshot, hash }))
      return "written"
    },
    async list(teamId, from, to) {
      return [...docs.values()]
        .filter((d) => d.teamId === teamId && d.date >= from && d.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ issues: _issues, ...rest }) => withoutInternals(rest))
    },
    async get(teamId, date) {
      const doc = docs.get(key(teamId, date))
      return doc ? withoutInternals(structuredClone(doc)) : null
    },
  }
}
