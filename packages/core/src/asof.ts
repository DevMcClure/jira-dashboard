/**
 * The dataset as it was at a moment in the past, rebuilt from the changelog.
 * The browser's "As of" view and the daily snapshot job both use this, so a
 * past day reads the same everywhere (docs/decisions/0037).
 *
 * Replayed: which issues existed, status (and category), story points,
 * assignee, priority, resolution, sprint and PI states, transitions.
 * Kept as they are now: sprint membership (like the live burndown, so a
 * replayed burndown equals the live one) and fields the changelog doesn't
 * track (summary, epic, labels, team, due date).
 */
import { categoryForStatus } from "./constants"
import { categoryAt, statusAt } from "./metrics"
import type { ChangelogEntry, Issue, JiraDataset, Objective, ProgramIncrement, Sprint } from "./types"

/** A changelog-tracked field's raw value at `t`: the first change's `from`, then each change up to `t`. */
function fieldAt(issue: Issue, field: string, t: Date, current: string | null): string | null {
  const changes = issue.changelog.filter((c) => c.field === field)
  if (changes.length === 0) return current
  let value = changes[0].from
  for (const c of changes) {
    if (c.at > t) break
    value = c.to
  }
  return value
}

/** Assignee (a person id) at `t`, replaying `assignee` changes. */
export const assigneeAt = (issue: Issue, t: Date) => fieldAt(issue, "assignee", t, issue.assigneeId)

/** Priority at `t`, replaying `priority` changes. */
export const priorityAt = (issue: Issue, t: Date) => fieldAt(issue, "priority", t, issue.priority)

/** Story points at `t`; null while unestimated (unlike `pointsAt`, which counts that as 0). */
function storyPointsAt(issue: Issue, t: Date): number | null {
  const raw = fieldAt(issue, "storyPoints", t, issue.storyPoints === null ? null : String(issue.storyPoints))
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : null
}

/** When it was resolved, as known at `t`: only if it was done at `t`. */
function resolvedAt(issue: Issue, t: Date, changelog: ChangelogEntry[]): Date | null {
  if (categoryAt(issue, t) !== "done") return null
  if (issue.resolved && issue.resolved <= t) return issue.resolved
  const intoDone = changelog.findLast((c) => c.field === "status" && c.to !== null && categoryForStatus(c.to, issue) === "done")
  return intoDone?.at ?? null
}

function issueAt(issue: Issue, t: Date): Issue {
  const changelog = issue.changelog.filter((c) => c.at <= t)
  const status = statusAt(issue, t)!
  return {
    ...issue,
    status,
    statusCategory: categoryForStatus(status, issue),
    storyPoints: storyPointsAt(issue, t),
    assigneeId: assigneeAt(issue, t),
    priority: priorityAt(issue, t),
    resolved: resolvedAt(issue, t, changelog),
    updated: issue.updated <= t ? issue.updated : (changelog.at(-1)?.at ?? issue.created),
    changelog,
  }
}

function sprintAt(sprint: Sprint, t: Date): Sprint {
  if (!sprint.startDate) return sprint
  if (t < sprint.startDate) return { ...sprint, state: "future", completeDate: null }
  const completed = sprint.completeDate ?? (sprint.state === "closed" ? sprint.endDate : null)
  if (completed && completed <= t) return { ...sprint, state: "closed" }
  return { ...sprint, state: "active", completeDate: null }
}

function piAt(pi: ProgramIncrement, t: Date): ProgramIncrement {
  const state = t < pi.startDate ? "future" : t > pi.endDate ? "closed" : "active"
  // Actual business value is only known once the PI has been assessed.
  const objectives: Objective[] = state === "closed" ? pi.objectives : pi.objectives.map((o) => ({ ...o, actualBusinessValue: null }))
  return { ...pi, state, objectives }
}

/** The dataset as it was at `at` (its "now" becomes `at`). At or after the export's own "now", it's returned unchanged. */
export function datasetAsOf(dataset: JiraDataset, at: Date): JiraDataset {
  if (at >= dataset.meta.generatedAt) return dataset
  const issues = dataset.issues.filter((i) => i.created <= at).map((i) => issueAt(i, at))
  const sprints = dataset.sprints.map((s) => sprintAt(s, at))
  const programIncrements = dataset.programIncrements.map((p) => piAt(p, at))
  const objectives = programIncrements.flatMap((p) => p.objectives)
  return {
    ...dataset,
    meta: { ...dataset.meta, generatedAt: at },
    sprints,
    programIncrements,
    issues,
    byKey: new Map(issues.map((i) => [i.key, i])),
    sprintById: new Map(sprints.map((s) => [s.id, s])),
    piById: new Map(programIncrements.map((p) => [p.id, p])),
    objectiveById: new Map(objectives.map((o) => [o.id, o])),
    transitions: dataset.transitions.filter((t) => t.at <= at),
  }
}
