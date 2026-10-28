import type { Issue, JiraDataset, ProgramIncrement, Sprint } from "./types"

/** What the dashboard is looking at: the current sprint, or one whole PI. */
export type Scope = { kind: "sprint" } | { kind: "pi"; piId: string }

export const SPRINT_SCOPE: Scope = { kind: "sprint" }

export type ResolvedScope = {
  kind: Scope["kind"]
  /** The PI in view: the chosen one, or the one holding the current sprint. */
  pi: ProgramIncrement | null
  /** Sprints whose tickets are in scope. */
  sprints: Sprint[]
  /** Sprints for history views (velocity, burndown picker, Sprints page). */
  historySprints: Sprint[]
  label: string
}

/** The running PI, else the latest one that has started, else the first. */
export function currentPi(dataset: JiraDataset): ProgramIncrement | null {
  const pis = dataset.programIncrements
  const now = dataset.meta.generatedAt
  return pis.find((p) => p.state === "active") ?? pis.filter((p) => p.startDate <= now).at(-1) ?? pis[0] ?? null
}

/** Each team's active sprints; a team with none falls back to its latest closed sprint. */
export function currentSprints(sprints: Sprint[]): Sprint[] {
  const byTeam = new Map<string | null, Sprint[]>()
  for (const s of sprints) byTeam.set(s.teamId, [...(byTeam.get(s.teamId) ?? []), s])
  return [...byTeam.values()].flatMap((list) => {
    const active = list.filter((s) => s.state === "active")
    if (active.length) return active
    const lastClosed = list.filter((s) => s.state === "closed").at(-1)
    return lastClosed ? [lastClosed] : []
  })
}

export function resolveScope(dataset: JiraDataset, scope: Scope): ResolvedScope {
  const pi = scope.kind === "pi" ? dataset.piById.get(scope.piId) : undefined
  if (pi) {
    const sprints = dataset.sprints.filter((s) => s.piId === pi.id)
    return { kind: "pi", pi, sprints, historySprints: sprints, label: pi.name }
  }
  const sprints = currentSprints(dataset.sprints)
  const holder = sprints.find((s) => s.piId)?.piId
  const sprintPi = (holder && dataset.piById.get(holder)) || currentPi(dataset)
  return {
    kind: "sprint",
    pi: sprintPi,
    sprints,
    historySprints: sprintPi ? dataset.sprints.filter((s) => s.piId === sprintPi.id) : dataset.sprints,
    label: "Current sprint",
  }
}

/**
 * Whether an issue is in one of the scope's sprints. When the scope has no
 * sprints at all (an export without sprints), every issue is in scope.
 */
export function inScope(issue: Issue, scopeSprintIds: Set<number>): boolean {
  return scopeSprintIds.size === 0 || issue.sprintIds.some((id) => scopeSprintIds.has(id))
}

/**
 * Issues plus the Epics they belong to. Epics sit in no sprint, so sprint
 * scope alone never picks them; they come in through their in-scope stories.
 * Epics are added after the issues, in dataset order, without duplicates.
 */
export function withEpics(issues: Issue[], dataset: JiraDataset): Issue[] {
  const keys = new Set(issues.map((i) => i.key))
  const epicKeys = new Set(issues.flatMap((i) => (i.epicKey && !keys.has(i.epicKey) ? [i.epicKey] : [])))
  return [...issues, ...dataset.issues.filter((i) => i.type === "Epic" && epicKeys.has(i.key))]
}
