import { useMemo } from "react"
import type { Sprint } from "@/lib/jira/types"
import { useData } from "./useData"

/** Sprints in scope of the header filters (selected sprints, else selected teams' sprints, else all). */
export function useScopedSprints(): Sprint[] {
  const { dataset, filters } = useData()
  return useMemo(() => {
    if (filters.sprintIds.length) return dataset.sprints.filter((s) => filters.sprintIds.includes(s.id))
    if (filters.teamIds.length) return dataset.sprints.filter((s) => s.teamId && filters.teamIds.includes(s.teamId))
    return dataset.sprints
  }, [dataset, filters])
}
