import { createContext } from "react"
import type { ReportConfig } from "@/lib/reports/report-config"

/** Set while a report is open: its config, where its pages live, and where "Exit report" goes. */
export type ReportMode = {
  config: ReportConfig
  /** Saved report id, or null for a shared link that isn't saved here. */
  id: string | null
  /** A shared link's code (also part of `basePath`), or null for a saved report. */
  code: string | null
  /** Prefix for the report's pages, e.g. "/reports/abc" or "/r/<code>". */
  basePath: string
  /** "Explore from here": copy the report's view into the user's own (unlocked) filters. */
  applyToDashboard: () => void
}

export const ReportModeContext = createContext<ReportMode | null>(null)

/** sessionStorage key: the normal-mode path to return to on "Exit report". */
export const REPORT_RETURN_KEY = "jira-dashboard:report-return"
