import { useCallback, useMemo } from "react"
import { categoryForStatus, statusColorVar } from "@/lib/jira/constants"
import type { StatusInfo } from "@/lib/jira/types"
import { useData } from "./useData"

/** Look up category + colour token for any status name in the dataset. */
export function useStatusInfo(): (status: string) => StatusInfo {
  const { dataset } = useData()
  const byName = useMemo(() => new Map(dataset.statuses.map((s) => [s.name, s])), [dataset])
  return useCallback(
    (status: string) => {
      const known = byName.get(status)
      if (known) return known
      const category = categoryForStatus(status)
      return { name: status, category, colorVar: statusColorVar(status, category) }
    },
    [byName],
  )
}
