import { useState } from "react"
import type { FlowTimeBasis } from "@/lib/jira/flow"

const KEY = "jira-dashboard:flow-time-basis"

function read(): FlowTimeBasis {
  try {
    return localStorage.getItem(KEY) === "started" ? "started" : "created"
  } catch {
    return "created"
  }
}

/** Where Flow Time starts: created (default, the DX definition) or work started. A per-viewer preference. */
export function useFlowTimeBasis(): [FlowTimeBasis, (basis: FlowTimeBasis) => void] {
  const [basis, setBasis] = useState<FlowTimeBasis>(read)
  const set = (next: FlowTimeBasis) => {
    setBasis(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
  }
  return [basis, set]
}
