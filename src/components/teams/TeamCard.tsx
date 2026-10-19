import { useMemo } from "react"
import { AvatarStack } from "@/components/common/AvatarStack"
import { PersonAvatar } from "@/components/common/PersonAvatar"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useData } from "@/hooks/useData"
import { countByStatusCategory, remainingPoints, velocity, workloadByPerson } from "@/lib/jira/metrics"
import type { Issue, Team } from "@/lib/jira/types"
import { VelocityChart } from "./VelocityChart"

type Props = { team: Team; issues: Issue[] }

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function TeamCard({ team, issues }: Props) {
  const { dataset } = useData()
  const { counts, remaining, vel, avgVelocity, workload } = useMemo(() => {
    const teamIssues = issues.filter((i) => i.teamId === team.id)
    const vel = velocity(team, dataset.sprints, teamIssues)
    return {
      counts: countByStatusCategory(teamIssues),
      remaining: remainingPoints(teamIssues),
      vel,
      avgVelocity: vel.length ? Math.round(vel.reduce((s, v) => s + v.completed, 0) / vel.length) : null,
      workload: new Map(workloadByPerson(teamIssues).map((w) => [w.personId, w])),
    }
  }, [team, issues, dataset])

  return (
    <Card>
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
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Velocity</p>
          <VelocityChart data={vel} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Members</p>
          <ul className="divide-y text-sm">
            {team.memberIds.map((id) => {
              const w = workload.get(id)
              const open = w ? w.todo + w.in_progress : 0
              return (
                <li key={id} className="flex items-center justify-between gap-3 py-2">
                  <PersonAvatar personId={id} />
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {open} open · {w?.openPoints ?? 0} pts
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
