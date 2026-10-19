import { useMemo } from "react"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { useFilteredTransitions } from "@/hooks/useFilteredTransitions"
import { kpiSummary } from "@/lib/jira/metrics"
import { StatCard, type Delta } from "./StatCard"

/** "+N <verb> this week", or `none` when nothing happened. */
function weekly(n: number, verb: string, none: string, tone: Delta["tone"]): Delta {
  return n > 0
    ? { text: `+${n} ${verb} this week`, direction: "up", tone }
    : { text: none, direction: "flat", tone: "neutral" }
}

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
        delta={weekly(k.total.delta, "created", "None created this week", "neutral")}
      />
      <StatCard
        label="In progress"
        value={k.inProgress.value}
        trend={k.inProgress.trend}
        delta={weekly(k.inProgress.delta, "started", "None started this week", "neutral")}
      />
      <StatCard
        label="Blocked"
        value={k.blocked.value}
        trend={k.blocked.trend}
        delta={weekly(k.blocked.delta, "blocked", "No new blockers this week", "bad")}
      />
      <StatCard
        label="In review"
        value={k.inReview.value}
        trend={k.inReview.trend}
        delta={weekly(k.inReview.delta, "sent to review", "None sent to review this week", "neutral")}
      />
    </div>
  )
}
