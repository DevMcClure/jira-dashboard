import { useContext, useMemo } from "react"
import type { Filters } from "@/context/data-context"
import { TeamScopeContext } from "@/context/team-scope"
import { useData } from "./useData"

/** Header filters, with the team replaced by the page's team scope when there is one. */
export function useEffectiveFilters(): Filters {
  const { filters } = useData()
  const teamId = useContext(TeamScopeContext)
  return useMemo(() => (teamId ? { ...filters, teamIds: [teamId] } : filters), [filters, teamId])
}
