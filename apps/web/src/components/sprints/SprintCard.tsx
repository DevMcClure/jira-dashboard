import { format } from "date-fns"
import { ArrowRight, Target } from "lucide-react"
import { StatusDot } from "@/components/common/StatusDot"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { pluralize } from "@/lib/format"
import type { countByStatus, scopeChange, sprintHealth } from "@jira-dashboard/core/metrics"
import type { Sprint } from "@jira-dashboard/core/types"
import { cn } from "@/lib/utils"

export type SprintStats = {
  health: ReturnType<typeof sprintHealth>
  scope: ReturnType<typeof scopeChange>
  statuses: ReturnType<typeof countByStatus>
  ticketCount: number
}

type Props = {
  sprint: Sprint
  teamName?: string
  stats: SprintStats
  onOpen: () => void
}

const STATE_BADGE: Record<Sprint["state"], { label: string; className: string }> = {
  active: { label: "Active", className: "border-status-done text-status-done" },
  closed: { label: "Closed", className: "text-muted-foreground" },
  future: { label: "Future", className: "border-status-progress text-status-progress" },
}

const fmt = (d: Date | null) => (d ? format(d, "d MMM") : "—")

/** One sprint: dates, state, goal, points progress, status mix, scope change. */
export function SprintCard({ sprint, teamName, stats, onOpen }: Props) {
  const { health, scope, statuses, ticketCount } = stats
  const badge = STATE_BADGE[sprint.state]

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group cursor-pointer gap-4 transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={`${sprint.name}: show its tickets`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {sprint.name}
          <Badge variant="outline" className={cn("font-normal", badge.className)}>
            {badge.label}
          </Badge>
        </CardTitle>
        <CardDescription className="tabular-nums">
          {teamName && `${teamName} · `}
          {sprint.startDate || sprint.endDate ? `${fmt(sprint.startDate)} – ${fmt(sprint.endDate)}` : "Dates unknown"}
          {sprint.state === "active" && sprint.endDate && ` · ${pluralize(health.daysLeft, "day")} left`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Target className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="line-clamp-2">{sprint.goal ?? "No sprint goal."}</span>
        </p>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium tabular-nums">{health.pctDone}% done</span>
            <span className="text-muted-foreground tabular-nums">
              {health.donePoints} / {health.totalPoints} pts
            </span>
          </div>
          <Progress value={health.pctDone} aria-label={`${health.pctDone}% of points done`} />
        </div>

        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {statuses.length === 0 && <li>No tickets</li>}
          {statuses.map((s) => (
            <li key={s.status} className="flex items-center gap-1.5">
              <StatusDot colorVar={s.colorVar} />
              {s.status}
              <span className="font-medium text-foreground tabular-nums">{s.count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="justify-between border-t pt-4 text-xs text-muted-foreground [.border-t]:pt-4">
        <span className="tabular-nums">
          {pluralize(ticketCount, "ticket")}
          {sprint.state !== "future" && (
            <>
              {" · "}
              {scope.added || scope.removed
                ? `scope ${scope.added ? `+${scope.added}` : ""}${scope.added && scope.removed ? " / " : ""}${
                    scope.removed ? `−${scope.removed}` : ""
                  } pts after start`
                : "no scope change"}
            </>
          )}
        </span>
        <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Issues <ArrowRight className="size-3" />
        </span>
      </CardFooter>
    </Card>
  )
}
