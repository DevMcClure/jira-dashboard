/**
 * Jira issues of type "Objective" (docs/decisions/0049, 0050). An objective's
 * epics are linked through Epic Link (either direction), parent, or a "relates
 * to" link (`relatedKeys`). Every Objective issue is listed on the Objectives
 * page; those whose epics place them in a PI also become that PI's objectives.
 */
import { piFromLabel } from "./derive-pis"
import type { Issue, Objective, ProgramIncrement, Sprint } from "./types"

const isType = (i: Issue, type: string) => i.type.toLowerCase() === type.toLowerCase()

/** The most common value, ties broken alphabetically; null for none. */
function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

/** Every Objective issue's key → its linked epics' keys (sorted), in issue order. */
export function objectiveEpicLinks(
  issues: Issue[],
  /** Issue key → keys of issues it "relates to", from the export's `relatedKeys`. */
  related: Map<string, string[]>,
): Map<string, string[]> {
  const epics = issues.filter((i) => isType(i, "Epic"))
  const relates = (a: string, b: string) => related.get(a)?.includes(b) || related.get(b)?.includes(a)
  return new Map(
    issues
      .filter((o) => isType(o, "Objective"))
      .map((o) => [
        o.key,
        epics
          .filter((e) => e.epicKey === o.key || e.parentKey === o.key || o.epicKey === e.key || relates(o.key, e.key))
          .map((e) => e.key)
          .sort(),
      ]),
  )
}

/**
 * PI objectives from Objective issues, for PIs whose export lists none. An
 * objective's PI is the most common PI of its epics: an epic's PI label, else
 * the PI of most of its stories' sprints. Objectives without a known PI are left out.
 */
export function objectivesFromIssues(
  issues: Issue[],
  /** From `objectiveEpicLinks`. */
  links: Map<string, string[]>,
  pis: ProgramIncrement[],
  sprints: Sprint[],
  teamIds: Set<string>,
): Objective[] {
  const piIds = new Set(pis.map((p) => p.id))
  const sprintPi = new Map(sprints.map((s) => [s.id, s.piId]))
  const byKey = new Map(issues.map((i) => [i.key, i]))

  const storyPis = new Map<string, (string | null)[]>()
  for (const i of issues) {
    if (!i.epicKey) continue
    storyPis.set(i.epicKey, [...(storyPis.get(i.epicKey) ?? []), ...i.sprintIds.map((id) => sprintPi.get(id) ?? null)])
  }
  const epicPi = (e: Issue) => e.labels.map(piFromLabel).find((id) => id !== null) ?? mostCommon(storyPis.get(e.key) ?? [])

  return [...links].flatMap(([key, epicKeys]): Objective[] => {
    const o = byKey.get(key)!
    const piId = mostCommon(epicKeys.map((k) => epicPi(byKey.get(k)!)))
    if (!piId || !piIds.has(piId)) return []
    return [
      {
        id: o.key,
        piId,
        teamId: o.teamId && teamIds.has(o.teamId) ? o.teamId : null,
        title: o.summary,
        description: o.description,
        ownerId: o.assigneeId,
        committed: true,
        plannedBusinessValue: null,
        actualBusinessValue: null,
        epicKeys,
        issueKeys: [],
      },
    ]
  })
}
