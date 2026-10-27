import { useState } from "react"
import type { TimeMode } from "@jira-dashboard/core/working-time"

const KEY = "jira-dashboard:flow-time-mode"

function read(): TimeMode {
  try {
    return localStorage.getItem(KEY) === "calendar" ? "calendar" : "working"
  } catch {
    return "working"
  }
}

/** Working hours or calendar time for flow charts. A per-viewer preference; defaults to working hours. */
export function useTimeMode(): [TimeMode, (mode: TimeMode) => void] {
  const [mode, setMode] = useState<TimeMode>(read)
  const set = (next: TimeMode) => {
    setMode(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
  }
  return [mode, set]
}
