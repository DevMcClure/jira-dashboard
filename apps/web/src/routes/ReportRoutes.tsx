import { Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { NotInReport } from "@/components/reports/NotInReport"
import { pagePath, type ReportConfig } from "@jira-dashboard/core/report-config"
import { exploreRoutes } from "./explore-routes"

/** A report's pages under its base path, in the normal layout. Anything else says it isn't in the report. */
export function ReportRoutes({ config }: { config: ReportConfig }) {
  const include = (id: string) => (config.pages as string[]).includes(id)
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {exploreRoutes(include)}
        {/* Without Overview the report's root goes to its landing page (relative to the base). */}
        {!include("overview") && <Route index element={<Navigate to={pagePath(config.landingPage).slice(1)} replace />} />}
        <Route path="*" element={<NotInReport />} />
      </Route>
    </Routes>
  )
}
