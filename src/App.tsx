import { lazy } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

// Route-level code splitting: charts/tables load with the page that needs them.
const AboutPage = lazy(() => import("@/pages/AboutPage"))
const ImportPage = lazy(() => import("@/pages/ImportPage"))
const MovementsPage = lazy(() => import("@/pages/MovementsPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))
const OverviewPage = lazy(() => import("@/pages/OverviewPage"))
const PeoplePage = lazy(() => import("@/pages/PeoplePage"))
const SprintsPage = lazy(() => import("@/pages/SprintsPage"))
const TeamsPage = lazy(() => import("@/pages/TeamsPage"))
const TicketsPage = lazy(() => import("@/pages/TicketsPage"))

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="tickets/:key" element={<TicketsPage />} />
            <Route path="sprints" element={<SprintsPage />} />
            <Route path="teams" element={<TeamsPage />} />
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
