import { useNavigate } from "react-router-dom"
import { StatusDot } from "@/components/common/StatusDot"
import { useAppPath } from "@/hooks/useAppPath"
import { useStatusInfo } from "@/hooks/useStatusInfo"
import { formatDays } from "@/lib/format"
import type { WaitQueue } from "@jira-dashboard/core/flow"
import type { TimeMode } from "@jira-dashboard/core/working-time"
import { FlowChartCard } from "./FlowChartCard"
import { flowTypeVar } from "./flow-type-colors"

type Props = { queues: WaitQueue[]; mode: TimeMode }

/** The live wait queues: each waiting status with its items, longest wait first. Click an item to open it. */
export function WaitingNow({ queues, mode }: Props) {
  const info = useStatusInfo()
  const navigate = useNavigate()
  const to = useAppPath()
  const count = queues.reduce((n, q) => n + q.items.length, 0)
  const unit = mode === "working" ? "wd" : "d"

  return (
    <FlowChartCard
      title="Waiting now"
      description={`${count} item${count === 1 ? "" : "s"} sitting in a waiting status, timed from when each entered it. Click one to open it.`}
      mode={mode}
      empty={count === 0 && "Nothing is waiting right now."}
      heightClass="h-40"
      hint="Waiting is where flow efficiency is lost. Clear the longest waits first, and look for a status that always has a queue."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {queues.map((q) => (
          <div key={q.status} className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <StatusDot colorVar={info(q.status).colorVar} />
              <span className="font-medium">{q.status}</span>
              <span className="ml-auto text-muted-foreground tabular-nums">
                {q.items.length} · {formatDays(q.totalDays)} {unit} in all
              </span>
            </div>
            <ul className="divide-y rounded-md border">
              {q.items.map((i) => (
                <li key={i.key}>
                  <button
                    type="button"
                    onClick={() => navigate(to(`/tickets/${i.key}`))}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <StatusDot colorVar={flowTypeVar(i.type)} />
                    <span className="shrink-0 font-mono text-xs">{i.key}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground" title={i.summary}>
                      {i.summary}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatDays(i.waitingDays)} {unit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </FlowChartCard>
  )
}
