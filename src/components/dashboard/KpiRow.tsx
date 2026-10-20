import { useMemo } from "react"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { useFilteredTransitions } from "@/hooks/useFilteredTransitions"
import { usePeriod } from "@/hooks/usePeriod"
import { kpiSummary } from "@/lib/jira/metrics"
import { StatCard, type Delta } from "./StatCard"

/** "+N <verb> <period>", e.g. "+3 started today", or "None <verb> <period>". */
function periodDelta(n: number, verb: string, phrase: string, tone: Delta["tone"]): Delta {
  return n > 0
    ? { text: `+${n} ${verb} ${phrase}`, direction: "up", tone }
    : { text: `None ${verb} ${phrase}`, direction: "flat", tone: "neutral" }
}

export function KpiRow() {
  const { dataset } = useData()
  const issues = useFilteredIssues()
  const transitions = useFilteredTransitions()
  const { range, phrase } = usePeriod()
  const k = useMemo(
    () => kpiSummary(issues, transitions, range, dataset.meta.generatedAt),
    [issues, transitions, range, dataset],
  )

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Total tickets"
        value={k.total.value}
        trend={k.total.trend}
        delta={periodDelta(k.total.delta, "created", phrase, "neutral")}
      />
      <StatCard
        label="In progress"
        value={k.inProgress.value}
        trend={k.inProgress.trend}
        delta={periodDelta(k.inProgress.delta, "started", phrase, "neutral")}
      />
      <StatCard
        label="Blocked"
        value={k.blocked.value}
        trend={k.blocked.trend}
        delta={periodDelta(k.blocked.delta, "blocked", phrase, "bad")}
      />
      <StatCard
        label="In review"
        value={k.inReview.value}
        trend={k.inReview.trend}
        delta={periodDelta(k.inReview.delta, "sent to review", phrase, "neutral")}
      />
    </div>
  )
}
