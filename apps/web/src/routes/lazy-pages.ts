import { lazy } from "react"

// Route-level code splitting: charts/tables load with the page that needs them.
export const DetailsPage = lazy(() => import("@/pages/DetailsPage"))
export const FlowPage = lazy(() => import("@/pages/FlowPage"))
export const HealthPage = lazy(() => import("@/pages/HealthPage"))
export const HistoryPage = lazy(() => import("@/pages/HistoryPage"))
export const MovementsPage = lazy(() => import("@/pages/MovementsPage"))
export const ObjectivesPage = lazy(() => import("@/pages/ObjectivesPage"))
export const OverviewPage = lazy(() => import("@/pages/OverviewPage"))
export const PeoplePage = lazy(() => import("@/pages/PeoplePage"))
export const PiPage = lazy(() => import("@/pages/PiPage"))
export const SprintsPage = lazy(() => import("@/pages/SprintsPage"))
export const TeamDetailPage = lazy(() => import("@/pages/TeamDetailPage"))
export const TicketsPage = lazy(() => import("@/pages/TicketsPage"))
