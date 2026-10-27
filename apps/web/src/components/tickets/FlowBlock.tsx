import { ClockBadge } from "@/components/flow/ClockBadge"
import { useData } from "@/hooks/useData"
import { useFlowConfig } from "@/hooks/useFlowConfig"
import { useTimeMode } from "@/hooks/useTimeMode"
import { formatDays } from "@/lib/format"
import { activeWaiting, flowEnd, flowStart } from "@jira-dashboard/core/flow"
import { flowStateOf, flowTypeOf, isFlowItem } from "@jira-dashboard/core/flowConfig"
import type { Issue } from "@jira-dashboard/core/types"
import { elapsedMs, toDays } from "@jira-dashboard/core/working-time"

const STATE_LABEL = { "not-started": "Not started", active: "Active", waiting: "Waiting", done: "Done" } as const

/** One ticket's flow: type, state, cycle time so far and active vs waiting time. Context only; read the Flow page for trends. */
export function FlowBlock({ issue }: { issue: Issue }) {
  const { dataset } = useData()
  const [mode] = useTimeMode()
  const now = dataset.meta.generatedAt
  const { config: cfg } = useFlowConfig()
  const hours = cfg.workingHours
  const unit = mode === "working" ? "working days" : "days"

  if (!isFlowItem(issue, cfg)) {
    return <p className="text-sm text-muted-foreground">{issue.type}s aren't counted as flow items.</p>
  }

  const start = flowStart(issue, cfg)
  const end = flowEnd(issue, cfg)
  const { active, waiting } = activeWaiting(issue, { mode, now, cfg })
  const total = active + waiting
  const cycle = start ? toDays(elapsedMs(start, end ?? now, mode, hours), mode, hours) : null
  const lead = toDays(elapsedMs(issue.created, end ?? now, mode, hours), mode, hours)
  const activePct = total > 0 ? Math.round((active / total) * 100) : null

  const rows: [string, string][] = [
    ["Flow type", flowTypeOf(issue, cfg)],
    ["Flow state", STATE_LABEL[flowStateOf(issue.status, issue, cfg)]],
    [end ? "Flow time (since created)" : "Flow time so far (since created)", `${formatDays(lead)} ${unit}`],
    [end ? "Cycle time (since work started)" : "Cycle time so far (since work started)", cycle === null ? "Not started" : `${formatDays(cycle)} ${unit}`],
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
