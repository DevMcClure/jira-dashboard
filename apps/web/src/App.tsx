import { lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import SavedReportRoute from "@/pages/SavedReportRoute"
import SharedLinkEntry from "@/pages/SharedLinkEntry"
import SharedReportRoute from "@/pages/SharedReportRoute"
import { exploreRoutes } from "@/routes/explore-routes"
import { HistoryPage } from "@/routes/lazy-pages"

const AboutPage = lazy(() => import("@/pages/AboutPage"))
const ExportPage = lazy(() => import("@/pages/ExportPage"))
const FlowSettingsPage = lazy(() => import("@/pages/FlowSettingsPage"))
const ImportPage = lazy(() => import("@/pages/ImportPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      {/* basename follows Vite's base, e.g. "/jira-dashboard" on GitHub Pages. */}
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Routes>
          <Route element={<AppLayout />}>
            {exploreRoutes()}
            <Route path="teams" element={<Navigate to="/" replace />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="settings/flow" element={<FlowSettingsPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          {/* Report mode (docs/decisions/0018): saved reports, and shared links (/r?c=… → /r/<code>/…). */}
          <Route path="reports/:id/*" element={<SavedReportRoute />} />
          <Route path="r" element={<SharedLinkEntry />} />
          <Route path="r/:code/*" element={<SharedReportRoute />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors={false} position="bottom-right" />
    </TooltipProvider>
  )
}
