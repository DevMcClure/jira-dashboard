import { useMemo } from "react"
import type { Sprint } from "@/lib/jira/types"
import { useData } from "./useData"
import { useEffectiveFilters } from "./useEffectiveFilters"

/** Sprints in scope of the header filters and any team scope (selected sprints, else the teams' sprints, else all). */
export function useScopedSprints(): Sprint[] {
  const { dataset } = useData()
  const filters = useEffectiveFilters()
  return useMemo(() => {
    if (filters.sprintIds.length) return dataset.sprints.filter((s) => filters.sprintIds.includes(s.id))
    if (filters.teamIds.length) return dataset.sprints.filter((s) => s.teamId && filters.teamIds.includes(s.teamId))
    return dataset.sprints
  }, [dataset, filters])
}
