import { useMemo } from "react"
import { resolveScope, type ResolvedScope } from "@jira-dashboard/core/scope"
import { useData } from "./useData"

/** The header scope (current sprint or a PI) resolved against the dataset. */
export function useScope(): ResolvedScope {
  const { dataset, scope } = useData()
  return useMemo(() => resolveScope(dataset, scope), [dataset, scope])
}
