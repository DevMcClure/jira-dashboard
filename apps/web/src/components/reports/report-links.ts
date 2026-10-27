import { DATA_MODE } from "@/lib/data/data-mode"
import { reportLink, type ReportConfig } from "@jira-dashboard/core/report-config"

/**
 * The link to share a report. With the server (api mode) it's the report's own
 * page, which needs sign-in and access; in the static build the link carries
 * the whole report (docs/decisions/0018, 0042).
 */
export function shareableLink(report: { id: string | null; config: ReportConfig }, origin = window.location.origin, base = import.meta.env.BASE_URL) {
  const root = base.endsWith("/") ? base : `${base}/`
  return DATA_MODE === "api" && report.id ? `${origin}${root}reports/${report.id}` : reportLink(report.config, origin, base)
}
