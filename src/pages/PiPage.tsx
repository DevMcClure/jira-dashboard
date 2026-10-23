import { format } from "date-fns"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusDot } from "@/components/common/StatusDot"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { PageHeader } from "@/components/layout/PageHeader"
import { EpicProgressTable } from "@/components/pi/EpicProgressTable"
import { PiBurnupChart } from "@/components/pi/PiBurnupChart"
import { PiSummary } from "@/components/pi/PiSummary"
import { PiTeamCard } from "@/components/pi/PiTeamCard"
import { PiTimeline } from "@/components/pi/PiTimeline"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/hooks/useData"
import { useEffectiveFilters } from "@/hooks/useEffectiveFilters"
import { useHistoryIssues } from "@/hooks/useFilteredIssues"
import { useScope } from "@/hooks/useScope"
import { pluralize } from "@/lib/format"
import { epicProgress, piHealth } from "@/lib/jira/metrics"
import type { Sprint } from "@/lib/jira/types"

const DATE_FMT = "d MMM yyyy"

/** The PI in view (the chosen one, or the current one in sprint scope): progress, sprints, teams and epics. */
export default function PiPage() {
  const { dataset, filters, setFilters, setBurndownSprintId } = useData()
  const { pi } = useScope()
  const { teamIds } = useEffectiveFilters()
  const issues = useHistoryIssues()
  const navigate = useNavigate()
  const now = dataset.meta.generatedAt

  // The PI's sprints for the selected teams; ignores picked sprints so the whole calendar shows.
  const sprints = useMemo(
    () => (pi ? dataset.sprints.filter((s) => s.piId === pi.id && (!teamIds.length || (s.teamId && teamIds.includes(s.teamId)))) : []),
    [dataset, pi, teamIds],
  )
  const teams = teamIds.length ? dataset.teams.filter((t) => teamIds.includes(t.id)) : dataset.teams

  const { health, epics } = useMemo(() => {
    if (!pi) return { health: null, epics: [] }
    const scoped = { ...pi, sprintIds: sprints.map((s) => s.id) }
    const ids = new Set(scoped.sprintIds)
    return {
      health: piHealth(scoped, issues, now),
      epics: epicProgress(issues.filter((i) => i.sprintIds.some((id) => ids.has(id)))),
    }
  }, [pi, sprints, issues, now])

  if (!pi || !health) {
    return (
      <>
        <PageHeader title="PI" description="Progress across a whole program increment." />
        <EmptyState className="h-40">
          This export has no program increments. Add a programIncrements list to see PI progress.
        </EmptyState>
      </>
    )
  }

  const level = HEALTH_LEVELS[health.level]
  // Teams share the calendar, so distinct start dates = sprints per team.
  const sprintsPerTeam = new Set(sprints.map((s) => s.startDate?.getTime())).size
  const open = (s: Sprint) => {
    setBurndownSprintId(s.id)
    setFilters({ ...filters, sprintIds: [s.id] })
    navigate("/tickets")
  }

  return (
    <>
      <PageHeader
        title={pi.name}
        description={`${format(pi.startDate, DATE_FMT)} – ${format(pi.endDate, DATE_FMT)} · ${pluralize(sprintsPerTeam, "sprint")} per team${filters.sprintIds.length ? " · sprint filter ignored here" : ""}`}
        actions={
          <Badge variant="outline" className="gap-1.5 font-normal">
            <StatusDot colorVar={level.colorVar} />
            {level.label}
          </Badge>
        }
      />
      <PiSummary pi={pi} health={health} sprintsPerTeam={sprintsPerTeam} />
      <PiBurnupChart pi={{ ...pi, sprintIds: sprints.map((s) => s.id) }} sprints={sprints} issues={issues} now={now} />
      <PiTimeline teams={teams} sprints={sprints} issues={issues} onOpen={open} />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {teams
          .filter((t) => sprints.some((s) => s.teamId === t.id))
          .map((t) => (
            <PiTeamCard key={t.id} team={t} pi={pi} sprints={sprints} issues={issues} now={now} />
          ))}
      </div>
      <EpicProgressTable epics={epics} />
    </>
  )
}
