/**
 * Where the server keeps datasets. Routes only talk to this interface, so
 * tests use the in-memory store and the server uses MongoDB.
 */
import { randomUUID } from "node:crypto"
import type { Db } from "mongodb"
import { collections, type IngestDoc, type IngestSource } from "./db"

export type Ingest = Omit<IngestDoc, "_id"> & { id: string }
export type CurrentDataset = { ingest: Ingest; json: string }
export type NewDataset = {
  json: string
  source: IngestSource
  generatedAt: Date | null
  counts: IngestDoc["counts"]
}

export interface DatasetStore {
  /** The dataset the dashboard shows now, or null before the first ingest or seed. */
  current(): Promise<CurrentDataset | null>
  /** Store a dataset and make it current (the previous one becomes superseded). */
  insertCurrent(dataset: NewDataset): Promise<Ingest>
  /** Throws if the database can't be reached. */
  ping(): Promise<void>
}

const toIngest = ({ _id, ...rest }: IngestDoc): Ingest => ({ id: _id, ...rest })

export function createMongoDatasetStore(db: Db): DatasetStore {
  const { ingests, datasets } = collections(db)
  return {
    async current() {
      const ingest = await ingests.findOne({ status: "current" })
      if (!ingest) return null
      const dataset = await datasets.findOne({ _id: ingest.datasetId })
      return dataset ? { ingest: toIngest(ingest), json: dataset.json } : null
    },

    async insertCurrent({ json, source, generatedAt, counts }) {
      const ingestId = randomUUID()
      const datasetId = randomUUID()
      // Ordered writes (no transaction, so a standalone Mongo works): store the data,
      // retire the old current, then make the new one current. If the last write fails,
      // the old dataset is already retired and GET /dataset 404s until the next ingest.
      await datasets.insertOne({ _id: datasetId, ingestId, json })
      await ingests.updateMany({ status: "current" }, { $set: { status: "superseded" } })
      const doc: IngestDoc = { _id: ingestId, receivedAt: new Date(), source, generatedAt, counts, status: "current", datasetId }
      await ingests.insertOne(doc)
      return toIngest(doc)
    },

    async ping() {
      await db.command({ ping: 1 })
    },
  }
}

/** For tests: same behaviour, no database. `failPing` simulates the database being down. */
export function createMemoryDatasetStore(opts: { failPing?: boolean } = {}): DatasetStore & { ingests: Ingest[] } {
  const ingests: Ingest[] = []
  const texts = new Map<string, string>()
  return {
    ingests,
    async current() {
      const ingest = ingests.find((i) => i.status === "current")
      return ingest ? { ingest, json: texts.get(ingest.datasetId)! } : null
    },
    async insertCurrent({ json, source, generatedAt, counts }) {
      for (const i of ingests) if (i.status === "current") i.status = "superseded"
      const ingest: Ingest = { id: randomUUID(), receivedAt: new Date(), source, generatedAt, counts, status: "current", datasetId: randomUUID() }
      texts.set(ingest.datasetId, json)
      ingests.push(ingest)
      return ingest
    },
    async ping() {
      if (opts.failPing) throw new Error("database unreachable")
    },
  }
}
