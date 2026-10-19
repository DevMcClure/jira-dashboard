import { useMemo } from "react"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { useFilteredTransitions } from "@/hooks/useFilteredTransitions"
import { kpiSummary } from "@/lib/jira/metrics"
import { pluralize } from "@/lib/format"
import { StatCard, type Delta } from "./StatCard"

const direction = (n: number): Delta["direction"] => (n > 0 ? "up" : n < 0 ? "down" : "flat")
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "No change,")

export function KpiRow() {
  const { dataset } = useData()
  const issues = useFilteredIssues()
  const transitions = useFilteredTransitions()
  const k = useMemo(
    () => kpiSummary(issues, transitions, dataset.meta.generatedAt),
    [issues, transitions, dataset],
  )

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Total tickets"
        value={k.total.value}
        trend={k.total.trend}
        delta={{
          text: `+${k.total.delta} created this week`,
          direction: k.total.delta > 0 ? "up" : "flat",
          tone: "neutral",
        }}
      />
      <StatCard
        label="Remaining"
        value={k.remaining.value}
        unit="pts"
        trend={k.remaining.trend}
        delta={{
          text: `${signed(k.remaining.delta)} points this week`,
          direction: direction(k.remaining.delta),
          tone: k.remaining.delta < 0 ? "good" : k.remaining.delta > 0 ? "bad" : "neutral",
        }}
      />
      <StatCard
        label="Completed"
        value={k.completed.value}
        trend={k.completed.trend}
        delta={{
          text: `+${k.completed.delta} done this week`,
          direction: k.completed.delta > 0 ? "up" : "flat",
          tone: k.completed.delta > 0 ? "good" : "neutral",
        }}
      />
      <StatCard
        label="Blocked"
        value={k.blocked.value}
        trend={k.blocked.trend}
        delta={{
          text: k.blocked.delta ? `${pluralize(k.blocked.delta, "new blocker")} this week` : "No new blockers this week",
          direction: k.blocked.delta > 0 ? "up" : "flat",
          tone: k.blocked.delta > 0 ? "bad" : "good",
        }}
      />
    </div>
  )
}
