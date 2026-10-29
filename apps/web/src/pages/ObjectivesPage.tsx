import { useMemo, useState } from "react"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import type { IssueObjectiveRowData } from "@/components/objectives/issue-objective-row-data"
import { IssueObjectiveGroup } from "@/components/objectives/IssueObjectiveGroup"
import { IssueObjectiveTiles } from "@/components/objectives/IssueObjectiveTiles"
import { ObjectiveGroup } from "@/components/objectives/ObjectiveGroup"
import type { ObjectiveRowData } from "@/components/objectives/objective-row-data"
import { ObjectiveSheet } from "@/components/objectives/ObjectiveSheet"
import { ObjectiveTiles } from "@/components/objectives/ObjectiveTiles"
import { useData } from "@/hooks/useData"
import { useEffectiveFilters } from "@/hooks/useEffectiveFilters"
import { useHistoryIssues } from "@/hooks/useFilteredIssues"
import { useScope } from "@/hooks/useScope"
import { epicsProgress, epicTickets, objectiveForecast, objectiveHealth, objectiveProgress, piPredictability } from "@jira-dashboard/core/metrics"

/**
 * PI objectives for the PI in view (the chosen one, or the current one in
 * sprint scope), rolled up from their epics' tickets in the PI. Below them,
 * every other Jira issue of type "Objective" (decision 0050), rolled up from
 * their epics' tickets in any sprint. Team and assignee filters and picked
 * sprints narrow the tickets counted; a team filter also hides other teams'
 * objectives. ART-level objectives always show.
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

  // Objective issues the PI in view doesn't list: in another PI, or in none.
  const otherRows = useMemo<IssueObjectiveRowData[]>(() => {
    const inPi = new Set(pi?.objectives.map((o) => o.id))
    return [...dataset.objectiveEpics].flatMap(([key, epicKeys]) => {
      const objective = dataset.byKey.get(key)
      if (!objective || inPi.has(key)) return []
      const teamId = objective.teamId && dataset.teamById.has(objective.teamId) ? objective.teamId : null
      if (teamId && teamIds.length && !teamIds.includes(teamId)) return []
      const piId = dataset.objectiveById.get(key)?.piId
      return [
        {
          objective,
          epicKeys,
          piName: piId ? (dataset.piById.get(piId)?.name ?? null) : null,
          tickets: epicTickets(epicKeys, issues),
          progress: epicsProgress(epicKeys, issues),
        },
      ]
    })
  }, [dataset, pi, issues, teamIds])

  const hasPiObjectives = !!pi && pi.objectives.length > 0
  const otherDescription = "Progress from the tickets in each one's linked epics, in any sprint."

  if (!hasPiObjectives) {
    if (!dataset.objectiveEpics.size) {
      return (
        <>
          <PageHeader title="Objectives" description="PI objectives and their progress, rolled up from epics and tickets." />
          <EmptyState className="h-40 px-6">
            No objectives yet. Every Jira issue of type “Objective” shows here, with progress from the epics linked to it
            by Epic Link or “relates to”.
          </EmptyState>
        </>
      )
    }
    const teamGroups = dataset.teams
      .map((t) => ({ team: t, rows: otherRows.filter((r) => r.objective.teamId === t.id) }))
      .filter((g) => g.rows.length)
    const artRows = otherRows.filter((r) => !r.objective.teamId || !dataset.teamById.has(r.objective.teamId))
    return (
      <>
        <PageHeader
          title="Objectives"
          description={`${pi ? `None are in ${pi.name} yet. ` : ""}Every Objective issue, with progress from the tickets in its linked epics, in any sprint.`}
        />
        <IssueObjectiveTiles rows={otherRows} />
        {teamGroups.map(({ team, rows: teamRows }) => (
          <IssueObjectiveGroup key={team.id} title={team.name} rows={teamRows} />
        ))}
        {artRows.length > 0 && <IssueObjectiveGroup title="ART level" description="Not in one team's project" rows={artRows} />}
        {otherRows.length === 0 && <EmptyState className="h-24">No objectives for the selected teams.</EmptyState>}
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
      {otherRows.length > 0 && (
        <IssueObjectiveGroup title={`Other objectives (not in ${pi.name})`} description={otherDescription} rows={otherRows} />
      )}
      <ObjectiveSheet row={open} pi={pi} sprints={sprints} issues={issues} onClose={() => setOpenId(null)} />
    </>
  )
}
