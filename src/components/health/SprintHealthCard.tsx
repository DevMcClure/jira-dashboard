import { format } from "date-fns"
import { StatusDot } from "@/components/common/StatusDot"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { pluralize } from "@/lib/format"
import type { BurndownPoint, scopeChange, sprintHealth } from "@/lib/jira/metrics"
import type { Sprint } from "@/lib/jira/types"
import { HEALTH_LEVELS } from "./health-levels"
import { MiniBurndown } from "./MiniBurndown"

type Props = {
  sprint: Sprint
  teamName?: string
  health: ReturnType<typeof sprintHealth>
  scope: ReturnType<typeof scopeChange>
  burndown: BurndownPoint[]
  onOpen: () => void
}

function Bar({ label, value, colorVar }: { label: string; value: number; colorVar: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: `var(${colorVar})` }} />
      </div>
    </div>
  )
}

/** One active sprint: health level, % done vs % time, scope change and a mini burndown. */
export function SprintHealthCard({ sprint, teamName, health, scope, burndown, onOpen }: Props) {
  const level = HEALTH_LEVELS[health.level]
  const gap = health.pctElapsed - health.pctDone
  const remaining = health.totalPoints - health.donePoints

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      aria-label={`${sprint.name}: open team details`}
      className="cursor-pointer gap-4 transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <CardHeader>
        <CardTitle>{sprint.name}</CardTitle>
        <CardDescription className="tabular-nums">
          {teamName && `${teamName} · `}
          {sprint.startDate && format(sprint.startDate, "d MMM")} – {sprint.endDate && format(sprint.endDate, "d MMM")}
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="gap-1.5 font-normal">
            <StatusDot colorVar={level.colorVar} />
            {level.label}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Bar label="Points done" value={health.pctDone} colorVar="--status-done" />
          <Bar label="Time elapsed" value={health.pctElapsed} colorVar="--muted-foreground" />
          <p className="text-xs text-muted-foreground tabular-nums">
            {gap > 0 ? `Done is ${gap} pts behind time elapsed` : `Done is ${-gap} pts ahead of time elapsed`}
          </p>
        </div>
        <MiniBurndown points={burndown} />
        <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Left</dt>
            <dd className="font-medium tabular-nums">{pluralize(health.daysLeft, "day")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Remaining</dt>
            <dd className="font-medium tabular-nums">{remaining} pts</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Scope change</dt>
            <dd className="font-medium tabular-nums">
              {scope.added || scope.removed ? `+${scope.added} / −${scope.removed}` : "None"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
