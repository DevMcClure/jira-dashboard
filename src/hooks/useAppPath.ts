import { useCallback } from "react"
import { useLocation } from "react-router-dom"
import { useReportMode } from "./useReportMode"

/**
 * App paths ("/tickets/X-1") → router paths. In a report they live under the
 * report's base ("/reports/abc/tickets/X-1"); otherwise unchanged.
 */
export function useAppPath(): (path: string) => string {
  const base = useReportMode()?.basePath ?? ""
  return useCallback((path: string) => (base ? `${base}${path === "/" ? "" : path}` || "/" : path), [base])
}

/** The current path as the app sees it: inside a report, without the report's base ("/reports/abc/details" → "/details"). */
export function useInnerPath(): string {
  const { pathname } = useLocation()
  const base = useReportMode()?.basePath ?? ""
  return base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname
}
