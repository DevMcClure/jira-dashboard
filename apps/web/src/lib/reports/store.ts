/**
 * The app's report store (browser-only for now; docs/decisions/0004). Pages go
 * through `saveReport` / `removeReport` so open lists refresh.
 */
import { createLocalReportStore } from "./local-report-store"
import { parseReportConfig, type ReportConfig } from "@jira-dashboard/core/report-config"
import type { StoredReport } from "./report-store"

export const reportStore = createLocalReportStore<ReportConfig>({ parse: parseReportConfig })

const listeners = new Set<() => void>()

/** Call `fn` whenever a report is saved or removed; returns an unsubscribe. */
export function onReportsChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export async function saveReport(report: { id?: string; config: ReportConfig }): Promise<StoredReport<ReportConfig>> {
  const saved = await reportStore.save(report)
  listeners.forEach((fn) => fn())
  return saved
}

export async function removeReport(id: string): Promise<void> {
  await reportStore.remove(id)
  listeners.forEach((fn) => fn())
}
