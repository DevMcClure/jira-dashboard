import { parseExportText } from "@/lib/jira/adapter"
import type { DataSource, FileLike, LoadedData } from "./data-source"

/** localStorage key for the last uploaded file. */
export const UPLOAD_STORAGE_KEY = "jira-dashboard:upload"

type Stored = { fileName: string; loadedAt: string; json: string }
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

type Options = {
  /** URL of the sample export, e.g. `${import.meta.env.BASE_URL}sample/jira-export.json`. */
  sampleUrl: string
  fetch?: typeof globalThis.fetch
  /** Defaults to `localStorage`; missing or throwing storage is tolerated. */
  storage?: StorageLike | null
}

/**
 * Today's behaviour behind the `DataSource` interface: a sample file served
 * next to the app, plus uploads remembered in the browser's storage.
 */
export function createStaticDataSource({ sampleUrl, fetch = globalThis.fetch, storage = defaultStorage() }: Options): DataSource {
  let sample: Promise<LoadedData> | null = null

  const loadSample = () => {
    sample ??= (async () => {
      const res = await fetch(sampleUrl)
      if (!res.ok) throw new Error(`Couldn't fetch the sample data (${res.status} ${res.statusText})`)
      const text = await res.text()
      return { dataset: parseExportText(text), origin: { kind: "sample" }, rawJson: text } satisfies LoadedData
    })()
    // A failed fetch can be retried.
    sample.catch(() => (sample = null))
    return sample
  }

  const readStored = (): Stored | null => {
    try {
      const s = storage?.getItem(UPLOAD_STORAGE_KEY)
      return s ? (JSON.parse(s) as Stored) : null
    } catch {
      return null
    }
  }

  const writeStored = (value: Stored | null): boolean => {
    if (!storage) return false
    try {
      if (value) storage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(value))
      else storage.removeItem(UPLOAD_STORAGE_KEY)
      return true
    } catch {
      return false
    }
  }

  return {
    async load() {
      const stored = readStored()
      if (stored) {
        try {
          return {
            dataset: parseExportText(stored.json),
            origin: { kind: "upload", fileName: stored.fileName, loadedAt: stored.loadedAt },
            rawJson: stored.json,
          }
        } catch {
          // No longer valid (e.g. the contract changed): forget it and use the sample.
          writeStored(null)
        }
      }
      return loadSample()
    },

    async loadFile(file: FileLike) {
      const text = await file.text()
      const dataset = parseExportText(text)
      const loadedAt = new Date().toISOString()
      const remembered = writeStored({ fileName: file.name, loadedAt, json: text })
      // Don't bring back an older upload on refresh when this one couldn't be kept.
      if (!remembered) writeStored(null)
      return { data: { dataset, origin: { kind: "upload", fileName: file.name, loadedAt }, rawJson: text }, remembered }
    },

    async reset() {
      writeStored(null)
      return loadSample()
    },
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}
