import { useEffect, useState } from "react"
import type { ReportConfig } from "@jira-dashboard/core/report-config"
import type { StoredReport } from "@/lib/reports/report-store"
import { onReportsChanged, reportStore } from "@/lib/reports/store"

/**
 * Reports other people shared with me (api mode), refreshed when reports
 * change, when one is opened (marking it read) and when the tab comes back
 * into view. `null` in the static build, where there's no sharing.
 */
export function useSharedReports(): StoredReport<ReportConfig>[] | null {
  const [reports, setReports] = useState<StoredReport<ReportConfig>[] | null>(null)
  useEffect(() => {
    const listShared = reportStore.listShared?.bind(reportStore)
    if (!listShared) return
    let live = true
    const load = () =>
      listShared().then(
        (list) => live && setReports(list),
        () => live && setReports((prev) => prev ?? []),
      )
    load()
    const off = onReportsChanged(load)
    const onVisible = () => {
      if (document.visibilityState === "visible") load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      live = false
      off()
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])
  return reports
}
