import { useCallback, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import sample from "@/data/jira-export.json"
import { JiraExportError, parseExport, parseExportText } from "@/lib/jira/adapter"
import type { Period } from "@/lib/jira/period"
import { SPRINT_SCOPE, type Scope } from "@/lib/jira/scope"
import type { JiraDataset } from "@/lib/jira/types"
import {
  DataContext,
  EMPTY_FILTERS,
  type DataSource,
  type Filters,
  type LoadResult,
} from "./data-context"

const STORAGE_KEY = "jira-dashboard:upload"

type Stored = { fileName: string; loadedAt: string; json: string }
type State = { dataset: JiraDataset; source: DataSource; rawJson: string }

const sampleJson = JSON.stringify(sample, null, 2)

function sampleState(): State {
  return { dataset: parseExport(sample), source: { kind: "sample" }, rawJson: sampleJson }
}

function readStored(): Stored | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? (JSON.parse(s) as Stored) : null
  } catch {
    return null
  }
}

function writeStored(value: Stored | null): boolean {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

/** Restore the last uploaded file, falling back to the bundled sample. */
function initialState(): State {
  const stored = readStored()
  if (stored) {
    try {
      return {
        dataset: parseExportText(stored.json),
        source: { kind: "upload", fileName: stored.fileName, loadedAt: stored.loadedAt },
        rawJson: stored.json,
      }
    } catch {
      writeStored(null)
    }
  }
  return sampleState()
}

function problemsFrom(err: unknown): string[] {
  if (err instanceof JiraExportError) return err.problems
  if (err instanceof SyntaxError) return [`Not valid JSON: ${err.message}`]
  return [err instanceof Error ? err.message : String(err)]
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState)
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

  const loadFromFile = useCallback(async (file: File): Promise<LoadResult> => {
    let text: string
    let dataset: JiraDataset
    try {
      text = await file.text()
      dataset = parseExportText(text)
    } catch (err) {
      const problems = problemsFrom(err)
      toast.error(`Couldn't load ${file.name}`, {
        description: problems.slice(0, 3).join(" · ") + (problems.length > 3 ? ` (+${problems.length - 3} more)` : ""),
      })
      return { ok: false, problems }
    }

    const loadedAt = new Date().toISOString()
    setState({ dataset, source: { kind: "upload", fileName: file.name, loadedAt }, rawJson: text })
    resetView()
    const remembered = writeStored({ fileName: file.name, loadedAt, json: text })
    toast.success(`Loaded ${dataset.issues.length} tickets from ${file.name}`, {
      description: remembered ? undefined : "File is too large to remember after a refresh.",
    })
    return { ok: true, dataset }
  }, [resetView])

  const resetToSample = useCallback(() => {
    writeStored(null)
    setState(sampleState())
    resetView()
    toast.success("Reset to sample data")
  }, [resetView])

  const value = useMemo(
    () => ({
      ...state,
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
    }),
    [state, loadFromFile, resetToSample, filters, burndownSprintId, period, scope],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
