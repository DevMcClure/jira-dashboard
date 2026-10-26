import { Route } from "react-router-dom"
import type { ReportPageId } from "@jira-dashboard/core/report-config"
import {
  DetailsPage,
  FlowPage,
  HealthPage,
  MovementsPage,
  ObjectivesPage,
  OverviewPage,
  PeoplePage,
  PiPage,
  SprintsPage,
  TeamDetailPage,
  TicketsPage,
} from "./lazy-pages"

/**
 * The "Explore the Sprints" pages as relative routes, shared by the normal app
 * and report mode (which passes `include` to keep only the report's pages).
 * A page's detail routes come with it: Overview → team pages, Tickets → a ticket.
 */
export function exploreRoutes(include: (id: ReportPageId) => boolean = () => true) {
  return (
    <>
      {include("overview") && (
        <>
          <Route index element={<OverviewPage />} />
          <Route path="teams/:teamId" element={<TeamDetailPage />} />
        </>
      )}
      {include("pi") && <Route path="pi" element={<PiPage />} />}
      {include("objectives") && <Route path="objectives" element={<ObjectivesPage />} />}
      {include("details") && <Route path="details" element={<DetailsPage />} />}
      {include("health") && <Route path="health" element={<HealthPage />} />}
      {include("tickets") && (
        <>
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/:key" element={<TicketsPage />} />
        </>
      )}
      {include("sprints") && <Route path="sprints" element={<SprintsPage />} />}
      {include("people") && <Route path="people" element={<PeoplePage />} />}
      {include("movements") && <Route path="movements" element={<MovementsPage />} />}
      {include("flow") && <Route path="flow" element={<FlowPage />} />}
    </>
  )
}
