import { useMemo } from "react"
import type { ChartConfig } from "@/components/ui/chart"
import { useData } from "./useData"

export type StatusSeries = { key: string; status: string; colorVar: string }

/**
 * One chart series per status in workflow order, with chart-safe keys (s0, s1…)
 * since status names contain spaces. Colour follows the status, never its rank.
 */
export function useStatusSeries() {
  const { dataset } = useData()
  return useMemo(() => {
    const series: StatusSeries[] = dataset.statuses.map((s, i) => ({
      key: `s${i}`,
      status: s.name,
      colorVar: s.colorVar,
    }))
    const config = Object.fromEntries(
      series.map((s) => [s.key, { label: s.status, color: `var(${s.colorVar})` }]),
    ) satisfies ChartConfig
    return { series, config }
  }, [dataset])
}
