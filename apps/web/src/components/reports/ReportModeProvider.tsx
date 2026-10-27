import { useMemo, type ReactNode } from "react"
import { DataContext, type DataContextValue } from "@/context/data-context"
import { ReportModeContext, type ReportMode } from "@/context/report-mode"
import { useData } from "@/hooks/useData"
import { viewFromConfig } from "@jira-dashboard/core/report-config"
import type { JiraDataset } from "@jira-dashboard/core/types"

type Props = Omit<ReportMode, "applyToDashboard" | "stored"> & {
  stored?: ReportMode["stored"]
  /** A frozen report's own data (B5); otherwise the loaded data. */
  dataset?: JiraDataset | null
  children: ReactNode
}

const locked = () => {}

/**
 * Renders the normal pages under a report's view: a nested DataContext whose
 * filters, scope and period come from the report and whose setters do nothing
 * (filters are locked). The user's own view in the outer DataProvider is left
 * untouched, so "Exit report" returns to it. See docs/decisions/0019.
 */
export function ReportModeProvider({ children, config, id, code, basePath, stored = null, dataset = null }: Props) {
  const outer = useData()
  const view = useMemo(() => viewFromConfig(config), [config])

  const value = useMemo<DataContextValue>(
    () => ({
      ...outer,
      // A report shows its frozen data, or the data as it is; never the dashboard's "As of" day.
      dataset: dataset ?? outer.liveDataset,
      liveDataset: dataset ?? outer.liveDataset,
      asOf: null,
      setAsOf: null,
      filters: view.filters,
      setFilters: locked,
      scope: view.scope,
      setScope: locked,
      period: view.period,
      setPeriod: locked,
      setCustomDates: locked,
      fixedRange: view.fixedRange,
    }),
    [outer, view, dataset],
  )

  const { setFilters, setScope, setPeriod, setCustomDates } = outer
  const reportMode = useMemo<ReportMode>(
    () => ({
      config,
      id,
      stored,
      code,
      basePath,
      applyToDashboard: () => {
        setFilters(view.filters)
        setScope(view.scope)
        setPeriod(view.period)
        // A custom range carries its dates into the user's own picker.
        if (view.period === "custom" && view.fixedRange) setCustomDates({ from: view.fixedRange.start, to: view.fixedRange.end })
      },
    }),
    [config, id, stored, code, basePath, view, setFilters, setScope, setPeriod, setCustomDates],
  )

  return (
    <ReportModeContext.Provider value={reportMode}>
      <DataContext.Provider value={value}>{children}</DataContext.Provider>
    </ReportModeContext.Provider>
  )
}
