import { ClockBadge } from "@/components/flow/ClockBadge"
import { useData } from "@/hooks/useData"
import { useTimeMode } from "@/hooks/useTimeMode"
import { formatDays } from "@/lib/format"
import { activeWaiting, flowEnd, flowStart } from "@/lib/jira/flow"
import { DEFAULT_FLOW_CONFIG, flowStateOf, flowTypeOf, isFlowItem } from "@/lib/jira/flowConfig"
import type { Issue } from "@/lib/jira/types"
import { elapsedMs, toDays } from "@/lib/jira/working-time"

const STATE_LABEL = { "not-started": "Not started", active: "Active", waiting: "Waiting", done: "Done" } as const

/** One ticket's flow: type, state, cycle time so far and active vs waiting time. Context only; read the Flow page for trends. */
export function FlowBlock({ issue }: { issue: Issue }) {
  const { dataset } = useData()
  const [mode] = useTimeMode()
  const now = dataset.meta.generatedAt
  const hours = DEFAULT_FLOW_CONFIG.workingHours
  const unit = mode === "working" ? "working days" : "days"

  if (!isFlowItem(issue)) {
    return <p className="text-sm text-muted-foreground">{issue.type}s aren't counted as flow items.</p>
  }

  const start = flowStart(issue)
  const end = flowEnd(issue)
  const { active, waiting } = activeWaiting(issue, { mode, now })
  const total = active + waiting
  const cycle = start ? toDays(elapsedMs(start, end ?? now, mode, hours), mode, hours) : null
  const activePct = total > 0 ? Math.round((active / total) * 100) : null

  const rows: [string, string][] = [
    ["Flow type", flowTypeOf(issue)],
    ["Flow state", STATE_LABEL[flowStateOf(issue.status, issue)]],
    [end ? "Cycle time" : "Cycle time so far", cycle === null ? "Not started" : `${formatDays(cycle)} ${unit}`],
    ["Active / waiting", total > 0 ? `${formatDays(toDays(active, mode, hours))} / ${formatDays(toDays(waiting, mode, hours))}` : "—"],
  ]

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0 space-y-1">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="truncate tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {activePct !== null && (
        <div className="space-y-1.5">
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${activePct}% active`}>
            <div className="h-full bg-status-progress" style={{ width: `${activePct}%` }} />
            <div className="h-full flex-1 bg-status-review" />
          </div>
          <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {activePct}% of its time actively worked. Per-ticket efficiency is noisy; it's context, not a score.
            </span>
            <ClockBadge mode={mode} />
          </p>
        </div>
      )}
    </div>
  )
}
