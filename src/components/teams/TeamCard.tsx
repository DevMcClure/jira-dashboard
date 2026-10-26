import { ArrowRight } from "lucide-react"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { AvatarStack } from "@/components/common/AvatarStack"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppPath } from "@/hooks/useAppPath"
import { useHistoryIssues } from "@/hooks/useFilteredIssues"
import { useHistorySprints } from "@/hooks/useScopedSprints"
import { pluralize } from "@/lib/format"
import {
  activitySummary,
  countByStatusCategory,
  remainingPoints,
  velocity,
  workloadByPerson,
} from "@/lib/jira/metrics"
import type { DateRange, Issue, Team, Transition } from "@/lib/jira/types"
import { TeamMembers } from "./TeamMembers"
import { VelocityChart } from "./VelocityChart"

type Props = {
  team: Team
  issues: Issue[]
  transitions: Transition[]
  range: DateRange
  /** Period label, e.g. "Today". */
  periodLabel: string
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Overview card for one team. Click to open the team's detail page. */
export function TeamCard({ team, issues, transitions, range, periodLabel }: Props) {
  const historyIssues = useHistoryIssues()
  const historySprints = useHistorySprints()
  const navigate = useNavigate()
  const to = useAppPath()
  const open = () => navigate(to(`/teams/${team.id}`))

  const { counts, remaining, vel, avgVelocity, workload, activity } = useMemo(() => {
    const teamIssues = issues.filter((i) => i.teamId === team.id)
    const keys = new Set(teamIssues.map((i) => i.key))
    const vel = velocity(team, historySprints, historyIssues.filter((i) => i.teamId === team.id))
    return {
      counts: countByStatusCategory(teamIssues),
      remaining: remainingPoints(teamIssues),
      vel,
      avgVelocity: vel.length ? Math.round(vel.reduce((s, v) => s + v.completed, 0) / vel.length) : null,
      workload: new Map(workloadByPerson(teamIssues).map((w) => [w.personId, w])),
      activity: activitySummary(
        teamIssues,
        transitions.filter((t) => keys.has(t.issueKey)),
        range,
      ),
    }
  }, [team, issues, transitions, range, historySprints, historyIssues])

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open()
      }}
      aria-label={`${team.name}: open team details`}
      className="group cursor-pointer transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <CardHeader>
        <CardTitle>{team.name}</CardTitle>
        <CardDescription>
          <span className="font-mono">{team.projectKey}</span> · {team.memberIds.length} members
        </CardDescription>
        <CardAction>
          <AvatarStack personIds={team.memberIds} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Tickets" value={counts.total} />
          <Stat label="Remaining" value={`${remaining} pts`} />
          <Stat label="Avg velocity" value={avgVelocity === null ? "—" : `${avgVelocity} pts`} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{periodLabel}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">{pluralize(activity.moves, "move")}</span> ·{" "}
            <span className="font-medium text-foreground">{activity.created}</span> created ·{" "}
            <span className="font-medium text-foreground">{activity.resolved}</span> done ·{" "}
            <span className="font-medium text-foreground">{activity.blocked}</span> blocked
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Velocity</p>
          <VelocityChart data={vel} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Members</p>
          <TeamMembers memberIds={team.memberIds} workload={workload} />
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t text-xs text-muted-foreground [.border-t]:pt-4">
        <span className="flex items-center gap-1 group-hover:text-foreground group-focus-visible:text-foreground">
          View team <ArrowRight className="size-3" />
        </span>
      </CardFooter>
    </Card>
  )
}
