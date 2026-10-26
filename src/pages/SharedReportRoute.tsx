import { useParams } from "react-router-dom"
import { FallbackToDashboard } from "@/components/reports/FallbackToDashboard"
import { ReportModeProvider } from "@/components/reports/ReportModeProvider"
import { decodeReportConfig } from "@/lib/reports/report-config"
import { ReportRoutes } from "@/routes/ReportRoutes"

/** /r/<code>/…: a shared report, decoded from its link on every visit (nothing needs to be saved). */
export default function SharedReportRoute() {
  const { code } = useParams()
  const config = decodeReportConfig(code)
  if (!config || !code) {
    return <FallbackToDashboard message="This report link is invalid or damaged" description="Showing the normal dashboard instead." />
  }
  return (
    <ReportModeProvider config={config} id={null} code={code} basePath={`/r/${code}`}>
      <ReportRoutes config={config} />
    </ReportModeProvider>
  )
}
