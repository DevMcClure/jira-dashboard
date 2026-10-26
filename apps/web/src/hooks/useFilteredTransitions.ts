import { useMemo } from "react"
import type { Transition } from "@jira-dashboard/core/types"
import { useData } from "./useData"
import { useFilteredIssues } from "./useFilteredIssues"

/** Status transitions belonging to the currently filtered issues (time-sorted). */
export function useFilteredTransitions(): Transition[] {
  const { dataset } = useData()
  const issues = useFilteredIssues()
  return useMemo(() => {
    if (issues.length === dataset.issues.length) return dataset.transitions
    const keys = new Set(issues.map((i) => i.key))
    return dataset.transitions.filter((t) => keys.has(t.issueKey))
  }, [dataset, issues])
}
