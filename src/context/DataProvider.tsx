import { useCallback, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import sample from "@/data/jira-export.json"
import { JiraExportError, parseExport } from "@/lib/jira/adapter"
import type { JiraDataset } from "@/lib/jira/types"
import {
  DataContext,
  EMPTY_FILTERS,
  type DataSource,
  type Filters,
  type LoadResult,
} from "./data-context"

const STORAGE_KEY = "sprint-atlas:upload"

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
        dataset: parseExport(JSON.parse(stored.json)),
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

  const loadFromFile = useCallback(async (file: File): Promise<LoadResult> => {
    let text: string
    let dataset: JiraDataset
    try {
      text = await file.text()
      dataset = parseExport(JSON.parse(text))
    } catch (err) {
      const problems = problemsFrom(err)
      toast.error(`Couldn't load ${file.name}`, {
        description: problems.slice(0, 3).join(" · ") + (problems.length > 3 ? ` (+${problems.length - 3} more)` : ""),
      })
      return { ok: false, problems }
    }

    const loadedAt = new Date().toISOString()
    setState({ dataset, source: { kind: "upload", fileName: file.name, loadedAt }, rawJson: text })
    setFilters(EMPTY_FILTERS)
    const remembered = writeStored({ fileName: file.name, loadedAt, json: text })
    toast.success(`Loaded ${dataset.issues.length} tickets from ${file.name}`, {
      description: remembered ? undefined : "File is too large to remember after a refresh.",
    })
    return { ok: true, dataset }
  }, [])

  const resetToSample = useCallback(() => {
    writeStored(null)
    setState(sampleState())
    setFilters(EMPTY_FILTERS)
    toast.success("Reset to sample data")
  }, [])

  const value = useMemo(
    () => ({ ...state, loadFromFile, resetToSample, filters, setFilters }),
    [state, loadFromFile, resetToSample, filters],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
