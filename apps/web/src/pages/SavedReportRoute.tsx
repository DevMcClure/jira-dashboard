import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { AppLoading } from "@/components/common/AppLoading"
import { FallbackToDashboard } from "@/components/reports/FallbackToDashboard"
import { ReportModeProvider } from "@/components/reports/ReportModeProvider"
import type { ReportConfig } from "@jira-dashboard/core/report-config"
import type { StoredReport } from "@/lib/reports/report-store"
import { onReportsChanged, reportStore } from "@/lib/reports/store"
import { ReportRoutes } from "@/routes/ReportRoutes"

type State = { status: "loading" } | { status: "missing" } | { status: "ready"; report: StoredReport<ReportConfig> }

/** /reports/<id>/…: a report saved in this browser. */
export default function SavedReportRoute() {
  const { id = "" } = useParams()
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let live = true
    const load = () =>
      reportStore.get(id).then(
        (report) => live && setState(report ? { status: "ready", report } : { status: "missing" }),
        () => live && setState({ status: "missing" }),
      )
    load()
    const off = onReportsChanged(load)
    return () => {
      live = false
      off()
    }
  }, [id])

  if (state.status === "loading") return <AppLoading state="loading" />
  if (state.status === "missing") {
    return (
      <FallbackToDashboard
        message="Report not found in this browser"
        description="Saved reports live in the browser that saved them. Ask for its link instead."
      />
    )
  }
  return (
    <ReportModeProvider config={state.report.config} id={id} code={null} basePath={`/reports/${id}`}>
      <ReportRoutes config={state.report.config} />
    </ReportModeProvider>
  )
}
