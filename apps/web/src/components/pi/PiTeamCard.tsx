import { StatusDot } from "@/components/common/StatusDot"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { VelocityChart } from "@/components/teams/VelocityChart"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { piHealth, velocity } from "@jira-dashboard/core/metrics"
import type { Issue, ProgramIncrement, Sprint, Team } from "@jira-dashboard/core/types"

type Props = { team: Team; pi: ProgramIncrement; sprints: Sprint[]; issues: Issue[]; now: Date }

/** One team's PI: progress vs time and committed/completed points per closed sprint. */
export function PiTeamCard({ team, pi, sprints, issues, now }: Props) {
  const teamIssues = issues.filter((i) => i.teamId === team.id)
  const teamSprints = sprints.filter((s) => s.teamId === team.id)
  const health = piHealth({ ...pi, sprintIds: teamSprints.map((s) => s.id) }, teamIssues, now)
  const level = HEALTH_LEVELS[health.level]
  const vel = velocity(team, teamSprints, teamIssues)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{team.name}</CardTitle>
        <CardDescription className="tabular-nums">
          {health.donePoints} of {health.totalPoints} pts · {health.ticketCount} tickets
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="gap-1.5 font-normal">
            <StatusDot colorVar={level.colorVar} />
            {level.label}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Points done</span>
            <span className="font-medium tabular-nums">
              {health.pctDone}% <span className="font-normal text-muted-foreground">· {health.pctElapsed}% of time</span>
            </span>
          </div>
          <Progress value={health.pctDone} aria-label={`${team.name}: ${health.pctDone}% of PI points done`} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Velocity this PI</p>
          <VelocityChart data={vel} />
        </div>
      </CardContent>
    </Card>
  )
}
