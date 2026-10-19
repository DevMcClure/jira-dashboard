import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import AboutPage from "@/pages/AboutPage"
import ImportPage from "@/pages/ImportPage"
import MovementsPage from "@/pages/MovementsPage"
import NotFoundPage from "@/pages/NotFoundPage"
import OverviewPage from "@/pages/OverviewPage"
import PeoplePage from "@/pages/PeoplePage"
import SprintsPage from "@/pages/SprintsPage"
import TeamsPage from "@/pages/TeamsPage"
import TicketsPage from "@/pages/TicketsPage"

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
