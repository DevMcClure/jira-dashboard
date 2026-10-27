import { Camera } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { SnapshotHistory } from "@/context/data-context"

/** Admins: snapshot yesterday now, instead of waiting for the morning run. */
export function TakeSnapshotButton({ history, onDone }: { history: SnapshotHistory; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const result = await history.takeNow()
      const written = result.teams.filter((t) => t.result === "written").length
      toast.success(`Snapshot of ${result.date}`, {
        description: `${written} of ${result.teams.length} teams written${written < result.teams.length ? ", the rest unchanged" : ""}${result.stale ? ". The data was generated before that day ended, so it's marked stale." : "."}`,
      })
      onDone()
    } catch (err) {
      toast.error("The snapshot didn't run", { description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy}>
      <Camera />
      {busy ? "Taking snapshot…" : "Take snapshot now"}
    </Button>
  )
}
