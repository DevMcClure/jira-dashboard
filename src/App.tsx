import { lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

// Route-level code splitting: charts/tables load with the page that needs them.
const AboutPage = lazy(() => import("@/pages/AboutPage"))
const DetailsPage = lazy(() => import("@/pages/DetailsPage"))
const HealthPage = lazy(() => import("@/pages/HealthPage"))
const ImportPage = lazy(() => import("@/pages/ImportPage"))
const MovementsPage = lazy(() => import("@/pages/MovementsPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))
const OverviewPage = lazy(() => import("@/pages/OverviewPage"))
const PeoplePage = lazy(() => import("@/pages/PeoplePage"))
const SprintsPage = lazy(() => import("@/pages/SprintsPage"))
const TeamDetailPage = lazy(() => import("@/pages/TeamDetailPage"))
const TicketsPage = lazy(() => import("@/pages/TicketsPage"))

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      {/* basename follows Vite's base, e.g. "/jira-dashboard" on GitHub Pages. */}
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="details" element={<DetailsPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="teams" element={<Navigate to="/" replace />} />
            <Route path="teams/:teamId" element={<TeamDetailPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="tickets/:key" element={<TicketsPage />} />
            <Route path="sprints" element={<SprintsPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="movements" element={<MovementsPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors={false} position="bottom-right" />
    </TooltipProvider>
  )
}
