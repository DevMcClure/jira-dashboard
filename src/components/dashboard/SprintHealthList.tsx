import { useMemo } from "react"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusDot } from "@/components/common/StatusDot"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useData } from "@/hooks/useData"
import { useHistoryIssues } from "@/hooks/useFilteredIssues"
import { useHistorySprints } from "@/hooks/useScopedSprints"
import { pluralize } from "@/lib/format"
import { sprintHealth } from "@/lib/jira/metrics"
import { cn } from "@/lib/utils"

/** Reference "SERVICE STATUS"-style list: dot + sprint name + one-line status. */
export function SprintHealthList() {
  const { dataset, burndownSprintId, setBurndownSprintId } = useData()
  const issues = useHistoryIssues()
  const sprints = useHistorySprints()
  const now = dataset.meta.generatedAt

  const rows = useMemo(
    () =>
      sprints
        .filter((s) => s.state !== "future")
        // Active first, then most recently ended.
        .sort((a, b) =>
          a.state === b.state
            ? (b.endDate?.getTime() ?? 0) - (a.endDate?.getTime() ?? 0)
            : a.state === "active"
              ? -1
              : 1,
        )
        .map((s) => ({ sprint: s, health: sprintHealth(s, issues, now) })),
    [sprints, issues, now],
  )

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Sprint health
        </CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" className="-my-1.5 h-7" asChild>
            <Link to="/health">
              View all <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="-mb-6 px-0">
        {rows.length === 0 ? (
          <EmptyState className="h-24 px-6">No started sprints in scope.</EmptyState>
        ) : (
          <ul className="divide-y border-t">
            {rows.map(({ sprint, health }) => {
              const level = HEALTH_LEVELS[health.level]
              const detail =
                health.level === "completed"
                  ? `${health.pctDone}% done`
                  : `${health.pctDone}% done · ${pluralize(health.daysLeft, "day")} left`
              return (
                <li key={sprint.id}>
                  <button
                    type="button"
                    onClick={() => setBurndownSprintId(sprint.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-6 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                      burndownSprintId === sprint.id && "bg-muted/40",
                    )}
                    title="Show in burndown"
                  >
                    <StatusDot colorVar={level.colorVar} className="mt-1.5" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{sprint.name}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {level.label} · {detail}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
