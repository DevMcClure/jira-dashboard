import { useMemo } from "react"
import type { Sprint } from "@/lib/jira/types"
import { useData } from "./useData"
import { useEffectiveFilters } from "./useEffectiveFilters"
import { useScope } from "./useScope"

/**
 * Sprints whose tickets are in view: the header's picked sprints if any, else
 * the scope's sprints (current sprint or a PI), narrowed to the selected teams.
 */
export function useScopedSprints(): Sprint[] {
  const { dataset } = useData()
  const filters = useEffectiveFilters()
  const scope = useScope()
  return useMemo(() => {
    if (filters.sprintIds.length) return dataset.sprints.filter((s) => filters.sprintIds.includes(s.id))
    return byTeams(scope.sprints, filters.teamIds)
  }, [dataset, filters, scope])
}

/**
 * Sprints for history views (health, burndown picker, Sprints page, velocity):
 * the header's picked sprints if any, else the scope's PI, narrowed to the selected teams.
 */
export function useHistorySprints(): Sprint[] {
  const { dataset } = useData()
  const filters = useEffectiveFilters()
  const scope = useScope()
  return useMemo(() => {
    if (filters.sprintIds.length) return dataset.sprints.filter((s) => filters.sprintIds.includes(s.id))
    return byTeams(scope.historySprints, filters.teamIds)
  }, [dataset, filters, scope])
}

function byTeams(sprints: Sprint[], teamIds: string[]): Sprint[] {
  return teamIds.length ? sprints.filter((s) => s.teamId && teamIds.includes(s.teamId)) : sprints
}
