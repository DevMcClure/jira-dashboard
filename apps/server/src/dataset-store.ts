/**
 * Where the server keeps datasets. Routes only talk to this interface, so
 * tests use the in-memory store and the server uses MongoDB.
 */
import { randomUUID } from "node:crypto"
import type { Db, ObjectId } from "mongodb"
import { collections, datasetFiles, type IngestDoc } from "./db"

export type Ingest = Omit<IngestDoc, "_id"> & { id: string }
export type CurrentDataset = { ingest: Ingest; json: string }

type Recorded = Pick<IngestDoc, "source" | "sha256" | "bytes" | "uploadedBy" | "fileName">
export type NewDataset = Recorded & {
  json: string
  generatedAt: Date | null
  counts: IngestDoc["counts"]
}
export type RejectedIngest = Recorded & { errors: string[] }

export interface DatasetStore {
  /** The dataset the dashboard shows now, or null before the first ingest or seed. */
  current(): Promise<CurrentDataset | null>
  /** The current ingest without its text (cheap; for polling). */
  meta(): Promise<Ingest | null>
  /** Any ingest's data, while its text is still kept (frozen reports). */
  byIngest(ingestId: string): Promise<CurrentDataset | null>
  /** Store a dataset and make it current (the previous one becomes superseded). */
  insertCurrent(dataset: NewDataset): Promise<Ingest>
  /** Keep a record of an ingest that failed validation. The current dataset is untouched. */
  recordRejected(rejected: RejectedIngest): Promise<Ingest>
  /**
   * Delete the texts of all but the newest `keep` stored datasets (their ingest
   * records stay), never those of `pinned` ingests. Returns how many went.
   */
  prune(keep: number, pinned?: string[]): Promise<number>
  /** Throws if the database can't be reached. */
  ping(): Promise<void>
}

const toIngest = ({ _id, ...rest }: IngestDoc): Ingest => ({ id: _id, ...rest })
const EMPTY_COUNTS = { teams: 0, people: 0, sprints: 0, issues: 0 }

/** MongoDB's document limit is 16 MB; texts above this go to GridFS. */
export const INLINE_LIMIT_BYTES = 15 * 1024 * 1024

export function createMongoDatasetStore(db: Db, { inlineLimitBytes = INLINE_LIMIT_BYTES } = {}): DatasetStore {
  const { ingests, datasets } = collections(db)
  const files = datasetFiles(db)

  const readText = async (fileId: ObjectId) => {
    const chunks: Buffer[] = []
    for await (const chunk of files.openDownloadStream(fileId)) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks).toString("utf8")
  }
  const writeText = (ingestId: string, json: string) =>
    new Promise<ObjectId>((resolve, reject) => {
      const upload = files.openUploadStream(`${ingestId}.json`, { metadata: { ingestId } })
      upload.once("error", reject).once("finish", () => resolve(upload.id))
      upload.end(Buffer.from(json, "utf8"))
    })

  const withText = async (ingest: IngestDoc | null): Promise<CurrentDataset | null> => {
    if (!ingest?.datasetId) return null
    const dataset = await datasets.findOne({ _id: ingest.datasetId })
    if (!dataset) return null
    const json = dataset.fileId ? await readText(dataset.fileId) : (dataset.json ?? "")
    return { ingest: toIngest(ingest), json }
  }

  return {
    async current() {
      return withText(await ingests.findOne({ status: "current" }))
    },

    async byIngest(ingestId) {
      return withText(await ingests.findOne({ _id: ingestId }))
    },

    async meta() {
      const ingest = await ingests.findOne({ status: "current" })
      return ingest ? toIngest(ingest) : null
    },

    async insertCurrent({ json, generatedAt, counts, ...recorded }) {
      const ingestId = randomUUID()
      const datasetId = randomUUID()
      // Ordered writes (no transaction, so a standalone Mongo works): store the data,
      // retire the old current, then make the new one current. If the last write fails,
      // the old dataset is already retired and GET /dataset 404s until the next ingest.
      if (Buffer.byteLength(json, "utf8") > inlineLimitBytes) {
        await datasets.insertOne({ _id: datasetId, ingestId, fileId: await writeText(ingestId, json) })
      } else {
        await datasets.insertOne({ _id: datasetId, ingestId, json })
      }
      await ingests.updateMany({ status: "current" }, { $set: { status: "superseded" } })
      const doc: IngestDoc = { ...recorded, _id: ingestId, receivedAt: new Date(), generatedAt, counts, status: "current", datasetId }
      await ingests.insertOne(doc)
      return toIngest(doc)
    },

    async recordRejected({ errors, ...recorded }) {
      const doc: IngestDoc = { ...recorded, _id: randomUUID(), receivedAt: new Date(), generatedAt: null, counts: EMPTY_COUNTS, status: "rejected", datasetId: null, errors }
      await ingests.insertOne(doc)
      return toIngest(doc)
    },

    async prune(keep, pinned = []) {
      const old = await ingests
        .find({ datasetId: { $ne: null }, status: { $ne: "current" }, _id: { $nin: pinned } }, { projection: { datasetId: 1 } })
        .sort({ receivedAt: -1 })
        .skip(Math.max(0, keep - 1)) // the current one counts towards `keep`
        .toArray()
      for (const ingest of old) {
        const dataset = await datasets.findOne({ _id: ingest.datasetId! })
        if (dataset?.fileId) await files.delete(dataset.fileId).catch(() => {})
        await datasets.deleteOne({ _id: ingest.datasetId! })
        await ingests.updateOne({ _id: ingest._id }, { $set: { datasetId: null } })
      }
      return old.length
    },

    async ping() {
      await db.command({ ping: 1 })
    },
  }
}

/** For tests: same behaviour, no database. `failPing` simulates the database being down. */
export function createMemoryDatasetStore(opts: { failPing?: boolean } = {}): DatasetStore & { ingests: Ingest[]; texts: Map<string, string> } {
  const ingests: Ingest[] = []
  const texts = new Map<string, string>()
  return {
    ingests,
    texts,
    async current() {
      const ingest = ingests.find((i) => i.status === "current")
      return ingest?.datasetId ? { ingest, json: texts.get(ingest.datasetId)! } : null
    },
    async meta() {
      return ingests.find((i) => i.status === "current") ?? null
    },
    async byIngest(ingestId) {
      const ingest = ingests.find((i) => i.id === ingestId)
      return ingest?.datasetId ? { ingest, json: texts.get(ingest.datasetId)! } : null
    },
    async insertCurrent({ json, generatedAt, counts, ...recorded }) {
      for (const i of ingests) if (i.status === "current") i.status = "superseded"
      const ingest: Ingest = { ...recorded, id: randomUUID(), receivedAt: new Date(), generatedAt, counts, status: "current", datasetId: randomUUID() }
      texts.set(ingest.datasetId!, json)
      ingests.push(ingest)
      return ingest
    },
    async recordRejected({ errors, ...recorded }) {
      const ingest: Ingest = { ...recorded, id: randomUUID(), receivedAt: new Date(), generatedAt: null, counts: EMPTY_COUNTS, status: "rejected", datasetId: null, errors }
      ingests.push(ingest)
      return ingest
    },
    async prune(keep, pinned = []) {
      const old = ingests
        .filter((i) => i.datasetId && i.status !== "current" && !pinned.includes(i.id))
        .reverse()
        .slice(Math.max(0, keep - 1))
      for (const i of old) {
        texts.delete(i.datasetId!)
        i.datasetId = null
      }
      return old.length
    },
    async ping() {
      if (opts.failPing) throw new Error("database unreachable")
    },
  }
}

