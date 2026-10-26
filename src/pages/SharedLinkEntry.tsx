import { Navigate, useSearchParams } from "react-router-dom"
import { FallbackToDashboard } from "@/components/reports/FallbackToDashboard"
import { decodeReportConfig, pagePath } from "@/lib/reports/report-config"

/** /r?c=<code>: the shareable link. Valid → the report's landing page under /r/<code>; anything else → the dashboard. */
export default function SharedLinkEntry() {
  const [params] = useSearchParams()
  const code = params.get("c")
  const config = decodeReportConfig(code)
  if (!config || !code) {
    return <FallbackToDashboard message="This report link is invalid or damaged" description="Showing the normal dashboard instead." />
  }
  const landing = pagePath(config.landingPage)
  return <Navigate to={`/r/${code}${landing === "/" ? "" : landing}`} replace />
}
