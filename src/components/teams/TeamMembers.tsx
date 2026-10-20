import { PersonAvatar } from "@/components/common/PersonAvatar"
import type { Workload } from "@/lib/jira/metrics"

/** Team members with their open ticket count and open points. */
export function TeamMembers({ memberIds, workload }: { memberIds: string[]; workload: Map<string | null, Workload> }) {
  return (
    <ul className="divide-y text-sm">
      {memberIds.map((id) => {
        const w = workload.get(id)
        const open = w ? w.todo + w.in_progress : 0
        return (
          <li key={id} className="flex items-center justify-between gap-3 py-2">
            <PersonAvatar personId={id} />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {open} open · {w?.openPoints ?? 0} pts
            </span>
          </li>
        )
      })}
    </ul>
  )
}
