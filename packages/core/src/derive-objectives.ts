/**
 * PI objectives from Jira issues of type "Objective" (docs/decisions/0049), for
 * PIs whose export lists no objectives. An objective's epics are linked through
 * Epic Link (either direction), parent, or a "relates to" link (`relatedKeys`);
 * its PI is the one its epics belong to.
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

export function objectivesFromIssues(
  issues: Issue[],
  /** Issue key → keys of issues it "relates to", from the export's `relatedKeys`. */
  related: Map<string, string[]>,
  pis: ProgramIncrement[],
  sprints: Sprint[],
  teamIds: Set<string>,
): Objective[] {
  const piIds = new Set(pis.map((p) => p.id))
  const sprintPi = new Map(sprints.map((s) => [s.id, s.piId]))
  const epics = new Map(issues.filter((i) => isType(i, "Epic")).map((e) => [e.key, e]))

  // An epic's PI: its PI label, else the PI of most of its stories' sprints.
  const storyPis = new Map<string, (string | null)[]>()
  for (const i of issues) {
    if (!i.epicKey) continue
    storyPis.set(i.epicKey, [...(storyPis.get(i.epicKey) ?? []), ...i.sprintIds.map((id) => sprintPi.get(id) ?? null)])
  }
  const epicPi = (e: Issue) => e.labels.map(piFromLabel).find((id) => id !== null) ?? mostCommon(storyPis.get(e.key) ?? [])

  const relates = (a: string, b: string) => related.get(a)?.includes(b) || related.get(b)?.includes(a)

  return issues
    .filter((o) => isType(o, "Objective"))
    .flatMap((o): Objective[] => {
      const epicKeys = [...epics.values()]
        .filter((e) => e.epicKey === o.key || e.parentKey === o.key || o.epicKey === e.key || relates(o.key, e.key))
        .map((e) => e.key)
        .sort()
      const piId = mostCommon(epicKeys.map((k) => epicPi(epics.get(k)!)))
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
