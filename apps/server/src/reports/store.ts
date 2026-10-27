/**
 * Where saved reports and their read marks live: MongoDB in the server,
 * memory in tests. Access rules are in access.ts; this only stores.
 */
import { randomUUID } from "node:crypto"
import type { Db } from "mongodb"
import { collections, type ReportDoc } from "../db"

export type NewReport = Pick<ReportDoc, "ownerId" | "config" | "recipients" | "frozen">
export type ReportPatch = Partial<Pick<ReportDoc, "config" | "recipients">> & { frozen?: ReportDoc["frozen"] | null }

export interface ReportStore {
  create(report: NewReport, at: Date): Promise<ReportDoc>
  get(id: string): Promise<ReportDoc | null>
  /** Null when there's no such report. `frozen: null` removes the pin. */
  update(id: string, patch: ReportPatch, at: Date): Promise<ReportDoc | null>
  delete(id: string): Promise<void>
  /** Newest change first. */
  listOwned(ownerId: string): Promise<ReportDoc[]>
  /** Reports shared with the person directly or through one of their groups, not their own; newest change first. */
  listSharedWith(userId: string, groups: string[]): Promise<ReportDoc[]>
  /** When the person last opened each of these reports. */
  lastReads(userId: string, reportIds: string[]): Promise<Map<string, Date>>
  markRead(reportId: string, userId: string, at: Date): Promise<void>
  /** Ingests that frozen reports show; retention keeps their data. */
  pinnedIngestIds(): Promise<string[]>
}

const newest = (a: ReportDoc, b: ReportDoc) => b.updatedAt.getTime() - a.updatedAt.getTime()

function applyPatch(doc: ReportDoc, { frozen, ...patch }: ReportPatch, at: Date): ReportDoc {
  const next: ReportDoc = { ...doc, ...patch, updatedAt: at }
  if (frozen === null) delete next.frozen
  else if (frozen) next.frozen = frozen
  return next
}

export function createMongoReportStore(db: Db): ReportStore {
  const { reports, reportReads } = collections(db)
  return {
    async create(report, at) {
      const doc: ReportDoc = { ...report, _id: randomUUID(), createdAt: at, updatedAt: at }
      if (!doc.frozen) delete doc.frozen
      await reports.insertOne(doc)
      return doc
    },
    get: (id) => reports.findOne({ _id: id }),
    async update(id, patch, at) {
      const doc = await reports.findOne({ _id: id })
      if (!doc) return null
      const next = applyPatch(doc, patch, at)
      await reports.replaceOne({ _id: id }, next)
      return next
    },
    async delete(id) {
      await reports.deleteOne({ _id: id })
      await reportReads.deleteMany({ reportId: id })
    },
    listOwned: (ownerId) => reports.find({ ownerId }).sort({ updatedAt: -1 }).toArray(),
    listSharedWith: (userId, groups) =>
      reports
        .find({ ownerId: { $ne: userId }, $or: [{ "recipients.users.id": userId }, { "recipients.groups": { $in: groups } }] })
        .sort({ updatedAt: -1 })
        .toArray(),
    async lastReads(userId, reportIds) {
      const reads = await reportReads.find({ userId, reportId: { $in: reportIds } }).toArray()
      return new Map(reads.map((r) => [r.reportId, r.lastReadAt]))
    },
    async markRead(reportId, userId, at) {
      await reportReads.updateOne({ reportId, userId }, { $set: { lastReadAt: at } }, { upsert: true })
    },
    async pinnedIngestIds() {
      return (await reports.distinct("frozen.ingestId")).filter((id): id is string => typeof id === "string")
    },
  }
}

export function createMemoryReportStore(): ReportStore & { docs: Map<string, ReportDoc> } {
  const docs = new Map<string, ReportDoc>()
  const reads = new Map<string, Date>()
  const readKey = (reportId: string, userId: string) => `${reportId}|${userId}`
  return {
    docs,
    async create(report, at) {
      const doc: ReportDoc = structuredClone({ ...report, _id: randomUUID(), createdAt: at, updatedAt: at })
      if (!doc.frozen) delete doc.frozen
      docs.set(doc._id, doc)
      return structuredClone(doc)
    },
    async get(id) {
      const doc = docs.get(id)
      return doc ? structuredClone(doc) : null
    },
    async update(id, patch, at) {
      const doc = docs.get(id)
      if (!doc) return null
      const next = applyPatch(doc, structuredClone(patch), at)
      docs.set(id, next)
      return structuredClone(next)
    },
    async delete(id) {
      docs.delete(id)
      for (const k of reads.keys()) if (k.startsWith(`${id}|`)) reads.delete(k)
    },
    async listOwned(ownerId) {
      return [...docs.values()].filter((d) => d.ownerId === ownerId).sort(newest).map((d) => structuredClone(d))
    },
    async listSharedWith(userId, groups) {
      return [...docs.values()]
        .filter((d) => d.ownerId !== userId && (d.recipients.users.some((u) => u.id === userId) || d.recipients.groups.some((g) => groups.includes(g))))
        .sort(newest)
        .map((d) => structuredClone(d))
    },
    async lastReads(userId, reportIds) {
      return new Map(reportIds.flatMap((id) => (reads.has(readKey(id, userId)) ? [[id, reads.get(readKey(id, userId))!] as const] : [])))
    },
    async markRead(reportId, userId, at) {
      reads.set(readKey(reportId, userId), at)
    },
    async pinnedIngestIds() {
      return [...new Set([...docs.values()].flatMap((d) => (d.frozen ? [d.frozen.ingestId] : [])))]
    },
  }
}
