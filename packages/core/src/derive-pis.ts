/**
 * PIs for exports without a `programIncrements` list (docs/decisions/0048).
 * Jira has no PI concept; teams mark it in sprint names ("Platform 2026 PI 5 -
 * Iteration 2") and epic labels ("PI5_2026"). This reads those marks.
 */
import type { Issue, Sprint } from "./types"

export type DerivedPi = { id: string; name: string; startDate: Date; endDate: Date }

/** "… 2026 PI 5 …" in a sprint name. */
const SPRINT_PI = /\b(\d{4})\s+PI\s*(\d+)\b/i
/** An epic label like "PI5_2026". */
const LABEL_PI = /^PI\s*(\d+)_(\d{4})$/i

const piId = (year: string, n: string) => `PI${Number(n)}_${year}`
const piName = (id: string) => {
  const [, n, year] = /^PI(\d+)_(\d{4})$/.exec(id)!
  return `${year} PI ${n}`
}

export function piFromSprintName(name: string): string | null {
  const m = SPRINT_PI.exec(name)
  return m ? piId(m[1], m[2]) : null
}

export function piFromLabel(label: string): string | null {
  const m = LABEL_PI.exec(label.trim())
  return m ? piId(m[2], m[1]) : null
}

/**
 * Each sprint's PI: from its name, else the PI most of its issues' epics are
 * labelled with. A PI spans its sprints' dates; one with no dated sprint is
 * dropped, since it can't be placed in time.
 */
export function derivePis(sprints: Sprint[], issues: Issue[]): { pis: DerivedPi[]; piOfSprint: Map<number, string> } {
  const byKey = new Map(issues.map((i) => [i.key, i]))
  const epicPi = (i: Issue): string | null => {
    const epic = i.epicKey ? byKey.get(i.epicKey) : undefined
    if (!epic) return null
    for (const l of epic.labels) {
      const id = piFromLabel(l)
      if (id) return id
    }
    return null
  }
  const votes = new Map<number, Map<string, number>>()
  for (const i of issues) {
    const id = epicPi(i)
    if (!id) continue
    for (const s of i.sprintIds) {
      const v = votes.get(s) ?? new Map<string, number>()
      v.set(id, (v.get(id) ?? 0) + 1)
      votes.set(s, v)
    }
  }

  const piOfSprint = new Map<number, string>()
  for (const s of sprints) {
    const fromVotes = [...(votes.get(s.id) ?? [])].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
    const id = piFromSprintName(s.name) ?? fromVotes
    if (id) piOfSprint.set(s.id, id)
  }

  const spans = new Map<string, { start: Date; end: Date }>()
  for (const s of sprints) {
    const id = piOfSprint.get(s.id)
    const end = s.endDate ?? s.completeDate
    if (!id || !s.startDate || !end) continue
    const span = spans.get(id)
    spans.set(id, {
      start: span && span.start < s.startDate ? span.start : s.startDate,
      end: span && span.end > end ? span.end : end,
    })
  }
  for (const [sprintId, id] of piOfSprint) if (!spans.has(id)) piOfSprint.delete(sprintId)

  const pis = [...spans].map(([id, { start, end }]) => ({ id, name: piName(id), startDate: start, endDate: end }))
  return { pis, piOfSprint }
}
