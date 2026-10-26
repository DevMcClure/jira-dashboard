import { useEffect, useState } from "react"
import type { ReportConfig } from "@jira-dashboard/core/report-config"
import type { StoredReport } from "@/lib/reports/report-store"
import { onReportsChanged, reportStore } from "@/lib/reports/store"

/** Saved reports, newest first, refreshed whenever one is saved or removed. `null` while loading or if storage is blocked. */
export function useReports(): StoredReport<ReportConfig>[] | null {
  const [reports, setReports] = useState<StoredReport<ReportConfig>[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      reportStore.list().then(
        (list) => live && setReports(list),
        () => live && setReports([]),
      )
    load()
    const off = onReportsChanged(load)
    return () => {
      live = false
      off()
    }
  }, [])
  return reports
}
