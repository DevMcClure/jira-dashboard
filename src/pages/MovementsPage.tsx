import { startOfDay, subDays } from "date-fns"
import { useMemo, useState } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { CreatedResolvedChart } from "@/components/movements/CreatedResolvedChart"
import { CumulativeFlowChart } from "@/components/movements/CumulativeFlowChart"
import { TransitionsPerDayChart } from "@/components/movements/TransitionsPerDayChart"
import { TransitionsTable } from "@/components/movements/TransitionsTable"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { useFilteredTransitions } from "@/hooks/useFilteredTransitions"
import { useScopedSprints } from "@/hooks/useScopedSprints"
import type { DateRange } from "@/lib/jira/types"

type RangeKey = "14" | "28" | "all"

export default function MovementsPage() {
  const { dataset } = useData()
  const issues = useFilteredIssues()
  const transitions = useFilteredTransitions()
  const sprints = useScopedSprints()
  const [rangeKey, setRangeKey] = useState<RangeKey>("all")
  const now = dataset.meta.generatedAt

  const range = useMemo<DateRange>(() => {
    if (rangeKey !== "all") return { start: startOfDay(subDays(now, Number(rangeKey) - 1)), end: now }
    // "All": from the first started sprint in scope (else the oldest ticket).
    const starts = sprints.filter((s) => s.state !== "future" && s.startDate).map((s) => s.startDate!.getTime())
    const first = starts.length ? Math.min(...starts) : Math.min(...issues.map((i) => i.created.getTime()), now.getTime())
    return { start: startOfDay(new Date(first)), end: now }
  }, [rangeKey, now, sprints, issues])

  return (
    <>
      <PageHeader
        title="Movements"
        description="How tickets flow through the workflow over time."
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={rangeKey}
            onValueChange={(v) => v && setRangeKey(v as RangeKey)}
            aria-label="Date range"
          >
            <ToggleGroupItem value="14" className="px-3">
              2 weeks
            </ToggleGroupItem>
            <ToggleGroupItem value="28" className="px-3">
              4 weeks
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="px-3">
              All sprints
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <CumulativeFlowChart issues={issues} range={range} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CreatedResolvedChart issues={issues} range={range} />
        <TransitionsPerDayChart transitions={transitions} range={range} />
      </div>
      <TransitionsTable transitions={transitions} range={range} />
    </>
  )
}
