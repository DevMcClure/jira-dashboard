import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { AppLoading } from "@/components/common/AppLoading"
import type { DataSource, LoadedData } from "@/lib/data/data-source"
import { createStaticDataSource } from "@/lib/data/static-data-source"
import { JiraExportError } from "@/lib/jira/adapter"
import type { Period } from "@/lib/jira/period"
import { SPRINT_SCOPE, type Scope } from "@/lib/jira/scope"
import { DataContext, EMPTY_FILTERS, type Filters, type LoadResult } from "./data-context"

/** The sample export, served from public/sample/ (under Vite's base, e.g. /jira-dashboard/ on Pages). */
const defaultSource = createStaticDataSource({ sampleUrl: `${import.meta.env.BASE_URL}sample/jira-export.json` })

function problemsFrom(err: unknown): string[] {
  if (err instanceof JiraExportError) return err.problems
  if (err instanceof SyntaxError) return [`Not valid JSON: ${err.message}`]
  return [err instanceof Error ? err.message : String(err)]
}

const summarise = (problems: string[]) =>
  problems.slice(0, 3).join(" · ") + (problems.length > 3 ? ` (+${problems.length - 3} more)` : "")

type Props = {
  children: ReactNode
  /** Where data comes from; defaults to the static sample + uploads. */
  dataSource?: DataSource
}

export function DataProvider({ children, dataSource = defaultSource }: Props) {
  const [data, setData] = useState<LoadedData | null>(null)
  /** Set when the first load failed and there's nothing to show yet. */
  const [bootError, setBootError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [burndownSprintId, setBurndownSprintId] = useState<number | null>(null)
  const [period, setPeriod] = useState<Period>("today")
  const [scope, setScope] = useState<Scope>(SPRINT_SCOPE)

  /** View state that only makes sense for the previous dataset. */
  const resetView = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setBurndownSprintId(null)
    setScope(SPRINT_SCOPE)
    setPeriod((p) => (p === "pi" ? "today" : p))
  }, [])

  useEffect(() => {
    let cancelled = false
    dataSource.load().then(
      (loaded) => !cancelled && setData(loaded),
      (err) => !cancelled && setBootError(summarise(problemsFrom(err))),
    )
    return () => {
      cancelled = true
    }
  }, [dataSource])

  const retryBoot = useCallback(() => {
    setBootError(null)
    dataSource.load().then(setData, (err) => setBootError(summarise(problemsFrom(err))))
  }, [dataSource])

  const loadFromFile = useCallback(
    async (file: File): Promise<LoadResult> => {
      try {
        const { data: loaded, remembered } = await dataSource.loadFile(file)
        setData(loaded)
        setBootError(null)
        resetView()
        toast.success(`Loaded ${loaded.dataset.issues.length} tickets from ${file.name}`, {
          description: remembered ? undefined : "File is too large to remember after a refresh.",
        })
        return { ok: true, dataset: loaded.dataset }
      } catch (err) {
        const problems = problemsFrom(err)
        toast.error(`Couldn't load ${file.name}`, { description: summarise(problems) })
        return { ok: false, problems }
      }
    },
    [dataSource, resetView],
  )

  const resetToSample = useCallback(() => {
    dataSource.reset().then(
      (loaded) => {
        setData(loaded)
        resetView()
        toast.success("Reset to sample data")
      },
      (err) => toast.error("Couldn't load the sample data", { description: summarise(problemsFrom(err)) }),
    )
  }, [dataSource, resetView])

  const value = useMemo(
    () =>
      data && {
        dataset: data.dataset,
        source: data.origin,
        rawJson: data.rawJson,
        loadFromFile,
        resetToSample,
        filters,
        setFilters,
        burndownSprintId,
        setBurndownSprintId,
        period,
        setPeriod,
        scope,
        setScope,
        fixedRange: null,
      },
    [data, loadFromFile, resetToSample, filters, burndownSprintId, period, scope],
  )

  if (!value) {
    return bootError ? (
      <AppLoading
        state="error"
        message={bootError}
        onRetry={retryBoot}
        onFile={async (file) => {
          // No toaster is mounted yet, so show a failed file's problems here instead.
          const result = await loadFromFile(file)
          if (!result.ok) setBootError(`${file.name}: ${summarise(result.problems)}`)
        }}
      />
    ) : (
      <AppLoading state="loading" />
    )
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
