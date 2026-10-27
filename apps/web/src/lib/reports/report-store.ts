/**
 * Saved reports. Pages only talk to this interface, so the browser-only store
 * can be swapped for a server-backed one (MongoDB, with recipients and access
 * control) without any page changing. See docs/decisions/0004.
 *
 * Generic over the config type: F3's versioned `ReportConfig` plugs in here.
 */

/** Who a report is shared with (server reports): people by id, and groups by name. */
export type ReportRecipients = { users: { id: string; displayName: string }[]; groups: string[] }

export type StoredReport<C> = {
  id: string
  /** ISO timestamps. */
  createdAt: string
  updatedAt: string
  config: C
  // Server reports (api mode) only:
  owner?: { id: string; displayName: string }
  recipients?: ReportRecipients
  /** Shared with me and changed since I last opened it. */
  unread?: boolean
  /** I own it: I can share, change and delete it. */
  canEdit?: boolean
  /** Frozen reports: the ingest whose data they show (fetched with `data`). */
  frozenIngestId?: string | null
}

/** A refused or failed request; `status` is the HTTP answer (0 when the server couldn't be reached). The message is safe to show. */
export class ReportStoreError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ReportStoreError"
    this.status = status
  }
}

export interface ReportStore<C> {
  /** Every saved report, most recently updated first. */
  list(): Promise<StoredReport<C>[]>
  get(id: string): Promise<StoredReport<C> | null>
  /** Creates a report (no `id`, or an unknown one) or replaces an existing one. */
  save(report: { id?: string; config: C }): Promise<StoredReport<C>>
  /** Removing an unknown id is a no-op. */
  remove(id: string): Promise<void>
  /** api mode: reports other people shared with me, most recently changed first. */
  listShared?(): Promise<StoredReport<C>[]>
  /** api mode: replace who the report is shared with (owner only). */
  share?(id: string, recipients: ReportRecipients): Promise<StoredReport<C>>
  /** api mode: a frozen report's own data (the export text it was made from). */
  data?(id: string): Promise<string>
}
