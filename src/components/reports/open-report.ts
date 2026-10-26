import type { NavigateFunction } from "react-router-dom"
import { REPORT_RETURN_KEY } from "@/context/report-mode"
import { pagePath, type ReportPageId } from "@/lib/reports/report-config"

/** Open a saved report at its landing page, remembering where "Exit report" should return to. */
export function openReport(navigate: NavigateFunction, id: string, landingPage: ReportPageId, returnTo: string) {
  try {
    // Opening one report from inside another keeps the original way back.
    if (!returnTo.startsWith("/reports/") && !returnTo.startsWith("/r/")) sessionStorage.setItem(REPORT_RETURN_KEY, returnTo)
  } catch {
    // No session storage: Exit report falls back to the dashboard.
  }
  const landing = pagePath(landingPage)
  navigate(`/reports/${id}${landing === "/" ? "" : landing}`)
}
