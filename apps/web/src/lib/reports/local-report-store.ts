import type { ReportStore, StoredReport } from "./report-store"

/** localStorage key for saved reports. */
export const REPORTS_STORAGE_KEY = "jira-dashboard:reports"

type StorageLike = Pick<Storage, "getItem" | "setItem">

type Options<C> = {
  /** Validates a stored config; return null to drop it (e.g. an old or tampered schema). */
  parse: (raw: unknown) => C | null
  key?: string
  /** Defaults to `localStorage`, looked up on each call so a blocked store rejects instead of throwing here. */
  storage?: StorageLike
  /** Injectable for tests. */
  now?: () => Date
  newId?: () => string
}

/**
 * Reports kept in this browser's localStorage, as one JSON array. Shared by
 * link for now (F3); a server store replaces this behind `ReportStore` later.
 * Storage failures (blocked, full) reject so the caller can tell the user.
 */
export function createLocalReportStore<C>({
  parse,
  key = REPORTS_STORAGE_KEY,
  storage,
  now = () => new Date(),
  newId = () => crypto.randomUUID(),
}: Options<C>): ReportStore<C> {
  const store = (): StorageLike => storage ?? globalThis.localStorage

  const read = (): StoredReport<C>[] => {
    const text = store().getItem(key)
    if (!text) return []
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return []
    }
    if (!Array.isArray(raw)) return []
    return raw.flatMap((r): StoredReport<C>[] => {
      if (typeof r !== "object" || r === null) return []
      const { id, createdAt, updatedAt } = r as Record<string, unknown>
      if (typeof id !== "string" || typeof createdAt !== "string" || typeof updatedAt !== "string") return []
      const config = parse((r as Record<string, unknown>).config)
      return config === null ? [] : [{ id, createdAt, updatedAt, config }]
    })
  }

  const write = (reports: StoredReport<C>[]) => store().setItem(key, JSON.stringify(reports))

  return {
    async list() {
      return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async get(id) {
      return read().find((r) => r.id === id) ?? null
    },

    async save({ id, config }) {
      const reports = read()
      const at = now().toISOString()
      const existing = id ? reports.find((r) => r.id === id) : undefined
      const report: StoredReport<C> = existing
        ? { ...existing, config, updatedAt: at }
        : { id: id ?? newId(), createdAt: at, updatedAt: at, config }
      write(existing ? reports.map((r) => (r.id === report.id ? report : r)) : [...reports, report])
      return report
    },

    async remove(id) {
      const reports = read()
      if (reports.some((r) => r.id === id)) write(reports.filter((r) => r.id !== id))
    },
  }
}
