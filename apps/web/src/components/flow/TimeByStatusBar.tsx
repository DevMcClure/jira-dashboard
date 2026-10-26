import { StatusDot } from "@/components/common/StatusDot"
import { useStatusInfo } from "@/hooks/useStatusInfo"
import { formatDays } from "@/lib/format"
import type { flowEfficiency } from "@jira-dashboard/core/flow"
import type { TimeMode } from "@jira-dashboard/core/working-time"
import { FlowChartCard } from "./FlowChartCard"

type Props = { byStatus: ReturnType<typeof flowEfficiency>["byStatus"]; mode: TimeMode; windowLabel: string }

const STATE_LABEL = { active: "active", waiting: "waiting", "not-started": "waiting", done: "waiting" } as const

/** "Where the time goes": the cycle time of finished items split by status, as one bar plus a labelled list. */
export function TimeByStatusBar({ byStatus, mode, windowLabel }: Props) {
  const info = useStatusInfo()
  const total = byStatus.reduce((s, b) => s + b.days, 0)
  const unit = mode === "working" ? "working days" : "days"
  return (
    <FlowChartCard
      title="Where the time goes"
      description={`Cycle time of items finished ${windowLabel}, by status.`}
      mode={mode}
      empty={total === 0 && "Nothing finished in this window."}
      heightClass="h-40"
    >
      <div className="space-y-4">
        <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded" role="img" aria-label="Time by status">
          {byStatus.map((b) => (
            <div
              key={b.status}
              className="h-full first:rounded-l last:rounded-r"
              style={{ width: `${(b.days / total) * 100}%`, backgroundColor: `var(${info(b.status).colorVar})` }}
              title={`${b.status}: ${formatDays(b.days)} ${unit}`}
            />
          ))}
        </div>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {byStatus.map((b) => (
            <li key={b.status} className="flex items-center gap-2 tabular-nums">
              <StatusDot colorVar={info(b.status).colorVar} />
              <span className="min-w-0 flex-1 truncate">
                {b.status} <span className="text-xs text-muted-foreground">({STATE_LABEL[b.state]})</span>
              </span>
              <span className="text-muted-foreground">{formatDays(b.days)} {mode === "working" ? "wd" : "d"}</span>
              <span className="w-10 text-right font-medium">{Math.round((b.days / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </FlowChartCard>
  )
}
