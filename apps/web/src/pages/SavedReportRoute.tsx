import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { AppLoading } from "@/components/common/AppLoading"
import { FallbackToDashboard } from "@/components/reports/FallbackToDashboard"
import { ReportModeProvider } from "@/components/reports/ReportModeProvider"
import { useData } from "@/hooks/useData"
import { DATA_MODE } from "@/lib/data/data-mode"
import { parseExportText } from "@jira-dashboard/core/adapter"
import type { ReportConfig } from "@jira-dashboard/core/report-config"
import type { JiraDataset } from "@jira-dashboard/core/types"
import { ReportStoreError, type StoredReport } from "@/lib/reports/report-store"
import { onReportsChanged, reportsChanged, reportStore } from "@/lib/reports/store"
import { ReportRoutes } from "@/routes/ReportRoutes"

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "failed"; message: string; description: string }
  | { status: "ready"; report: StoredReport<ReportConfig>; dataset: JiraDataset | null }

/**
 * /reports/<id>/…: a saved report. In the static build it's in this browser;
 * with the server, access is checked there (403 if it isn't shared with you),
 * and a frozen report shows the data it was made from.
 */
export default function SavedReportRoute() {
  const { id = "" } = useParams()
  const { source } = useData()
  const loadedIngest = source.kind === "server" ? source.ingestId : null
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const report = await reportStore.get(id)
        if (!report) return live && setState({ status: "missing" })
        // A frozen report made from other data than what's loaded reads its own.
        const own = report.frozenIngestId && report.frozenIngestId !== loadedIngest && reportStore.data
        const dataset = own ? parseExportText(await reportStore.data!(id)) : null
        if (live) setState({ status: "ready", report, dataset })
        // Opening it marked it read on the server: refresh the sidebar's unread marks.
        if (report.unread) reportsChanged()
      } catch (err) {
        if (!live) return
        if (err instanceof ReportStoreError && err.status === 403) {
          setState({ status: "failed", message: "You don't have access to this report", description: err.message })
        } else {
          setState({ status: "failed", message: "Couldn't open the report", description: err instanceof Error ? err.message : String(err) })
        }
      }
    }
    void load()
    const off = onReportsChanged(() => void load())
    return () => {
      live = false
      off()
    }
  }, [id, loadedIngest])

  if (state.status === "loading") return <AppLoading state="loading" />
  if (state.status === "failed") return <FallbackToDashboard message={state.message} description={state.description} />
  if (state.status === "missing") {
    return DATA_MODE === "api" ? (
      <FallbackToDashboard message="Report not found" description="It may have been deleted, or the link is wrong." />
    ) : (
      <FallbackToDashboard
        message="Report not found in this browser"
        description="Saved reports live in the browser that saved them. Ask for its link instead."
      />
    )
  }
  return (
    <ReportModeProvider config={state.report.config} id={id} stored={state.report} dataset={state.dataset} code={null} basePath={`/reports/${id}`}>
      <ReportRoutes config={state.report.config} />
    </ReportModeProvider>
  )
}
