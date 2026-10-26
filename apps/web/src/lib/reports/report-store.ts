/**
 * Saved reports. Pages only talk to this interface, so the browser-only store
 * can be swapped for a server-backed one (MongoDB, with recipients and access
 * control) without any page changing. See docs/decisions/0004.
 *
 * Generic over the config type: F3's versioned `ReportConfig` plugs in here.
 */

export type StoredReport<C> = {
  id: string
  /** ISO timestamps. */
  createdAt: string
  updatedAt: string
  config: C
}

export interface ReportStore<C> {
  /** Every saved report, most recently updated first. */
  list(): Promise<StoredReport<C>[]>
  get(id: string): Promise<StoredReport<C> | null>
  /** Creates a report (no `id`, or an unknown one) or replaces an existing one. */
  save(report: { id?: string; config: C }): Promise<StoredReport<C>>
  /** Removing an unknown id is a no-op. */
  remove(id: string): Promise<void>
}
