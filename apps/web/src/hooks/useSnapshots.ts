import { useEffect, useState } from "react"
import type { SnapshotHistory } from "@/context/data-context"
import type { SnapshotSummary } from "@/lib/data/data-source"

type Settled = { status: "error"; message: string } | { status: "ready"; snapshots: SnapshotSummary[] }
type State = { status: "loading" } | Settled

/** One team's stored snapshots for a range; bump `reload` to fetch again (after taking a snapshot). */
export function useSnapshots(history: SnapshotHistory | null, teamId: string, from: string, to: string, reload: number): State {
  const key = `${teamId}|${from}|${to}|${reload}`
  const [result, setResult] = useState<{ key: string; state: Settled } | null>(null)
  useEffect(() => {
    if (!history || !teamId) return
    let cancelled = false
    history.list(teamId, from, to).then(
      (snapshots) => !cancelled && setResult({ key, state: { status: "ready", snapshots } }),
      (err: Error) => !cancelled && setResult({ key, state: { status: "error", message: err.message } }),
    )
    return () => {
      cancelled = true
    }
  }, [history, teamId, from, to, key])
  // Until this request's answer arrives, it's loading (no stale answer for another team or range).
  return result?.key === key ? result.state : { status: "loading" }
}
