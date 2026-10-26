import { StatusDot } from "@/components/common/StatusDot"
import { FLOW_TYPES, type FlowType } from "@/lib/jira/flowConfig"
import { FlowChartCard } from "./FlowChartCard"
import { flowTypeVar } from "./flow-type-colors"
import { FlowTypeBar } from "./FlowTypeBar"

type Props = { wip: Record<FlowType, number>; finished: Record<FlowType, number>; periodPhrase: string }

/** Where effort is going now (work in progress) next to what was delivered (finished in the period). */
export function DistributionNow({ wip, finished, periodPhrase }: Props) {
  const rows = [
    { label: "In progress now", counts: wip },
    { label: `Finished ${periodPhrase}`, counts: finished },
  ]
  const total = (c: Record<FlowType, number>) => FLOW_TYPES.reduce((n, t) => n + c[t], 0)
  return (
    <FlowChartCard
      title="Work mix: now vs finished"
      description="Share of items by flow type."
      mode="count"
      heightClass="h-40"
      hint="The right balance depends on the product's stage: newer products lean to features; mature ones need more defect, risk and debt work. A feature-only mix can speed revenue now while debt builds up."
    >
      <div className="space-y-5">
        {rows.map((r) => (
          <div key={r.label} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="text-muted-foreground tabular-nums">{total(r.counts)} items</span>
            </div>
            <FlowTypeBar counts={r.counts} label={r.label} className="h-4" />
          </div>
        ))}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
          {FLOW_TYPES.map((t) => {
            const pct = (c: Record<FlowType, number>) => (total(c) ? `${Math.round((c[t] / total(c)) * 100)}%` : "—")
            return (
              <li key={t} className="flex items-center gap-1.5 tabular-nums">
                <StatusDot colorVar={flowTypeVar(t)} />
                <span className="font-medium">{t}</span>
                <span className="text-muted-foreground">
                  {pct(wip)} / {pct(finished)}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </FlowChartCard>
  )
}
