import { useMemo, useState } from "react"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { ObjectiveGroup } from "@/components/objectives/ObjectiveGroup"
import type { ObjectiveRowData } from "@/components/objectives/objective-row-data"
import { ObjectiveSheet } from "@/components/objectives/ObjectiveSheet"
import { ObjectiveTiles } from "@/components/objectives/ObjectiveTiles"
import { useData } from "@/hooks/useData"
import { useEffectiveFilters } from "@/hooks/useEffectiveFilters"
import { useHistoryIssues } from "@/hooks/useFilteredIssues"
import { useScope } from "@/hooks/useScope"
import { objectiveForecast, objectiveHealth, objectiveProgress, piPredictability } from "@jira-dashboard/core/metrics"

/**
 * PI objectives for the PI in view (the chosen one, or the current one in
 * sprint scope), rolled up from their epics' tickets. Team and assignee filters
 * and picked sprints narrow the tickets counted; a team filter also hides other
 * teams' objectives. ART-level objectives always show.
 */
export default function ObjectivesPage() {
  const { dataset } = useData()
  const { pi } = useScope()
  const { teamIds, sprintIds } = useEffectiveFilters()
  const historyIssues = useHistoryIssues()
  const [openId, setOpenId] = useState<string | null>(null)
  const now = dataset.meta.generatedAt

  const issues = useMemo(
    () => (sprintIds.length ? historyIssues.filter((i) => i.sprintIds.some((id) => sprintIds.includes(id))) : historyIssues),
    [historyIssues, sprintIds],
  )
  const sprints = useMemo(() => (pi ? dataset.sprints.filter((s) => s.piId === pi.id) : []), [dataset, pi])

  const rows = useMemo<ObjectiveRowData[]>(() => {
    if (!pi) return []
    return pi.objectives
      .filter((o) => o.teamId === null || !teamIds.length || teamIds.includes(o.teamId))
      .map((o) => ({
        objective: o,
        progress: objectiveProgress(o, pi, issues),
        health: objectiveHealth(o, pi, issues, now),
        forecast: objectiveForecast(o, pi, issues, now),
      }))
  }, [pi, issues, teamIds, now])

  if (!pi || pi.objectives.length === 0) {
    return (
      <>
        <PageHeader title="Objectives" description="PI objectives and their progress, rolled up from epics and tickets." />
        <EmptyState className="h-40 px-6">
          {pi
            ? `${pi.name} has no objectives in this export. Add an objectives list to the PI to track them here.`
            : "This export has no program increments, so there are no PI objectives to show."}
        </EmptyState>
      </>
    )
  }

  // Business value isn't ticket-based, so only the team filter (which objectives show) affects it.
  const predictability = piPredictability(rows.map((r) => r.objective))
  const teamGroups = dataset.teams
    .map((t) => ({ team: t, rows: rows.filter((r) => r.objective.teamId === t.id) }))
    .filter((g) => g.rows.length)
  const artRows = rows.filter((r) => r.objective.teamId === null)
  const open = rows.find((r) => r.objective.id === openId) ?? null

  return (
    <>
      <PageHeader
        title={`${pi.name} objectives`}
        description="Progress from each objective's epics and tickets. The marker on each bar shows how much of the PI has gone."
      />
      <ObjectiveTiles pi={pi} rows={rows} predictability={predictability} />
      {teamGroups.map(({ team, rows: teamRows }) => (
        <ObjectiveGroup key={team.id} title={team.name} rows={teamRows} pi={pi} issues={issues} onOpenBurnup={setOpenId} />
      ))}
      {artRows.length > 0 && (
        <ObjectiveGroup
          title="ART level"
          description="Delivered across teams"
          rows={artRows}
          pi={pi}
          issues={issues}
          onOpenBurnup={setOpenId}
        />
      )}
      {rows.length === 0 && <EmptyState className="h-24">No objectives for the selected teams.</EmptyState>}
      <ObjectiveSheet row={open} pi={pi} sprints={sprints} issues={issues} onClose={() => setOpenId(null)} />
    </>
  )
}
