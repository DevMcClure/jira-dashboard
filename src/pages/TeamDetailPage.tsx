import { ArrowLeft } from "lucide-react"
import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { AvatarStack } from "@/components/common/AvatarStack"
import { EmptyState } from "@/components/common/EmptyState"
import { DetailsContent } from "@/components/dashboard/DetailsContent"
import { PageHeader } from "@/components/layout/PageHeader"
import { TeamMembers } from "@/components/teams/TeamMembers"
import { VelocityChart } from "@/components/teams/VelocityChart"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TeamScopeContext } from "@/context/team-scope"
import { useAppPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import { useFilteredIssues, useHistoryIssues } from "@/hooks/useFilteredIssues"
import { useHistorySprints } from "@/hooks/useScopedSprints"
import { velocity, workloadByPerson } from "@/lib/jira/metrics"
import type { Team } from "@/lib/jira/types"

/** /teams/:teamId — the Details view scoped to one team, plus its members and velocity. */
export default function TeamDetailPage() {
  const { teamId } = useParams()
  const { dataset } = useData()
  const team = teamId ? dataset.teamById.get(teamId) : undefined
  const to = useAppPath()

  const back = (
    <Button variant="outline" size="sm" asChild>
      <Link to={to("/")}>
        <ArrowLeft />
        All teams
      </Link>
    </Button>
  )

  if (!team) {
    return (
      <>
        <PageHeader title="Team not found" description={`There's no team "${teamId}" in the loaded data.`} actions={back} />
        <EmptyState className="h-40" />
      </>
    )
  }

  return (
    <TeamScopeContext.Provider value={team.id}>
      <PageHeader
        title={team.name}
        description={`${team.projectKey ?? team.id} · ${team.memberIds.length} members · Tickets, sprint progress and movement for this team.`}
        actions={
          <div className="flex items-center gap-3">
            <AvatarStack personIds={team.memberIds} max={6} />
            {back}
          </div>
        }
      />
      <DetailsContent />
      <TeamExtras team={team} />
    </TeamScopeContext.Provider>
  )
}

/** Velocity and members, rendered inside the team scope. */
function TeamExtras({ team }: { team: Team }) {
  const issues = useFilteredIssues()
  const historyIssues = useHistoryIssues()
  const historySprints = useHistorySprints()
  const { vel, workload } = useMemo(
    () => ({
      vel: velocity(team, historySprints, historyIssues),
      workload: new Map(workloadByPerson(issues).map((w) => [w.personId, w])),
    }),
    [team, historySprints, historyIssues, issues],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Velocity</CardTitle>
          <CardDescription>Committed vs completed points per closed sprint</CardDescription>
        </CardHeader>
        <CardContent>
          <VelocityChart data={vel} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Open tickets and points per person</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembers memberIds={team.memberIds} workload={workload} />
        </CardContent>
      </Card>
    </div>
  )
}
