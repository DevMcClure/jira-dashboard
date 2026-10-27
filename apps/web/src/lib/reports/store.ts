/**
 * The app's report store: this browser's localStorage in the static build,
 * the server in api mode (docs/decisions/0004, 0042). Pages go through
 * `saveReport` / `removeReport` / `shareReport` so open lists refresh.
 */
import { API_BASE_URL, DATA_MODE } from "@/lib/data/data-mode"
import { parseReportConfig, type ReportConfig } from "@jira-dashboard/core/report-config"
import { createApiReportStore } from "./api-report-store"
import { createLocalReportStore } from "./local-report-store"
import type { ReportRecipients, StoredReport } from "./report-store"

/** Reports saved in this browser (in api mode, only for "Import my local reports"). */
export const localReportStore = createLocalReportStore<ReportConfig>({ parse: parseReportConfig })

export const reportStore = DATA_MODE === "api" ? createApiReportStore({ baseUrl: API_BASE_URL }) : localReportStore

const listeners = new Set<() => void>()

/** Tell open lists to reload (e.g. after opening a shared report, which marks it read). */
export const reportsChanged = () => listeners.forEach((fn) => fn())

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

export async function shareReport(id: string, recipients: ReportRecipients): Promise<StoredReport<ReportConfig>> {
  if (!reportStore.share) throw new Error("Sharing needs the dashboard's server.")
  const shared = await reportStore.share(id, recipients)
  listeners.forEach((fn) => fn())
  return shared
}
