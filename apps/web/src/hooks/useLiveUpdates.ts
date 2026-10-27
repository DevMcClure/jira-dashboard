import { useEffect, useRef } from "react"
import { toast } from "sonner"

/** The toast's id, so it's shown once and can be dismissed after a refresh. */
export const LIVE_UPDATE_TOAST = "live-update"
export const LIVE_UPDATE_INTERVAL_MS = 60_000

type Options = {
  /** Asks the server for its current ingest id; absent in the static build, which never polls. */
  check: (() => Promise<string | null>) | undefined
  /** The server ingest this browser last loaded. */
  knownId: string | null
  /** True while a local file is being previewed instead of the server's data. */
  previewing: boolean
  onRefresh: () => void
}

/**
 * Polls for new server data every minute while the tab is visible (and as soon
 * as it becomes visible), and offers a Refresh when the ingest changes. It
 * never swaps the data on its own, so nobody's view changes under them.
 */
export function useLiveUpdates({ check, knownId, previewing, onRefresh }: Options) {
  const offered = useRef<string | null>(null)
  const latest = useRef({ previewing, onRefresh })
  useEffect(() => {
    latest.current = { previewing, onRefresh }
  })

  useEffect(() => {
    if (!check || !knownId) return
    let stopped = false
    const tick = async () => {
      if (document.visibilityState !== "visible") return
      const id = await check().catch(() => null)
      if (stopped || !id || id === knownId || id === offered.current) return
      offered.current = id
      toast("New data on the server", {
        id: LIVE_UPDATE_TOAST,
        duration: Number.POSITIVE_INFINITY,
        description: latest.current.previewing
          ? "You're previewing a local file. Refresh to switch to the server's data."
          : "Refresh to see it. Your filters stay as they are.",
        action: { label: "Refresh", onClick: () => latest.current.onRefresh() },
      })
    }
    const timer = window.setInterval(tick, LIVE_UPDATE_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [check, knownId])
}
