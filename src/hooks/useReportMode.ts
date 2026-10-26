import { useContext } from "react"
import { ReportModeContext, type ReportMode } from "@/context/report-mode"

/** The open report, or null in normal mode. */
export function useReportMode(): ReportMode | null {
  return useContext(ReportModeContext)
}
