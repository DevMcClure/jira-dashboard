/**
 * The ONLY place that knows the raw export shape.
 *
 * If the real Jira Trawler output differs from docs/02-DATA_CONTRACT.md, change
 * this file (and `schema.ts`) so it still produces a `JiraDataset`. Nothing else
 * in the app should need to change.
 */
import { categoryForStatus, compareStatus, statusColorVar } from "./constants"
import { exportSchema, type RawExport, type RawIssue } from "./schema"
import {
  isTrawlerLog,
  isTrawlerShape,
  normaliseTrawlerInput,
  parseTrawlerLog,
  trawlerExportSchema,
  trawlerToContract,
} from "./trawler"
import type {
  ChangelogEntry,
  Issue,
  JiraDataset,
  Meta,
  Person,
  ProgramIncrement,
  Sprint,
  StatusCategory,
  StatusInfo,
  Team,
  Transition,
} from "./types"

export class JiraExportError extends Error {
  /** Every validation problem as "path: message". */
  readonly problems: string[]

  constructor(problems: string[]) {
    const shown = problems.slice(0, 5)
    const more = problems.length > shown.length ? `\n…and ${problems.length - shown.length} more` : ""
    super(`Invalid Jira export:\n${shown.join("\n")}${more}`)
    this.name = "JiraExportError"
    this.problems = problems
  }
}

const toDate = (s: string | null | undefined): Date | null => (s ? new Date(s) : null)
const toStr = (v: string | number | null | undefined): string | null =>
  v === null || v === undefined ? null : String(v)

const problemList = (issues: { path: PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)

/** Accepts the contract shape or raw Trawler JSON output (see `trawler.ts`). */
export function parseExport(raw: unknown): JiraDataset {
  if (isTrawlerShape(raw)) {
    const trawler = trawlerExportSchema.safeParse(normaliseTrawlerInput(raw))
    if (!trawler.success) throw new JiraExportError(problemList(trawler.error.issues))
    raw = trawlerToContract(trawler.data)
  }
  const result = exportSchema.safeParse(raw)
  if (!result.success) throw new JiraExportError(problemList(result.error.issues))
  return buildDataset(result.data)
}

/** File contents: JSON (either shape) or a Trawler audit log. */
export function parseExportText(text: string): JiraDataset {
  if (isTrawlerLog(text)) return parseExport(parseTrawlerLog(text))
  return parseExport(JSON.parse(text))
}

function buildDataset(data: RawExport): JiraDataset {
  const issues = data.issues.map(toIssue)
  const people = (data.people ?? []).map(
    (p): Person => ({
      id: p.id,
      displayName: p.displayName,
      email: p.email ?? null,
      avatarUrl: p.avatarUrl ?? null,
    }),
  )
  const teams = (data.teams ?? []).map(
    (t): Team => ({
      id: t.id,
      name: t.name,
      projectKey: t.projectKey ?? null,
      memberIds: t.memberIds ?? [],
    }),
  )
  const sprints = (data.sprints ?? [])
    .map(
      (s): Sprint => ({
        id: s.id,
        name: s.name,
        teamId: s.teamId ?? null,
        state: s.state,
        goal: s.goal ?? null,
        startDate: toDate(s.startDate),
        endDate: toDate(s.endDate),
        completeDate: toDate(s.completeDate),
        piId: s.piId ?? null,
      }),
    )
    .sort((a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity))

  synthesiseMissingPeople(people, teams, issues)

  const transitions = buildTransitions(issues)
  const meta = toMeta(data, issues, teams, sprints)
  const programIncrements = toProgramIncrements(data, sprints, meta.generatedAt)

  return {
    meta,
    teams,
    people,
    sprints,
    programIncrements,
    issues,
    byKey: new Map(issues.map((i) => [i.key, i])),
    personById: new Map(people.map((p) => [p.id, p])),
    sprintById: new Map(sprints.map((s) => [s.id, s])),
    teamById: new Map(teams.map((t) => [t.id, t])),
    piById: new Map(programIncrements.map((p) => [p.id, p])),
    transitions,
    statuses: collectStatuses(issues),
  }
}

function toIssue(r: RawIssue): Issue {
  const changelog: ChangelogEntry[] = (r.changelog ?? [])
    .map((c) => ({
      at: new Date(c.at),
      authorId: c.authorId ?? null,
      field: c.field,
      from: toStr(c.from),
      to: toStr(c.to),
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  const created = new Date(r.created)
  const lastChange = changelog.at(-1)?.at
  return {
    key: r.key,
    id: toStr(r.id),
    summary: r.summary,
    description: r.description ?? null,
    type: r.type ?? "Task",
    status: r.status,
    statusCategory: r.statusCategory,
    priority: r.priority ?? null,
    assigneeId: r.assigneeId ?? null,
    reporterId: r.reporterId ?? null,
    teamId: r.teamId ?? null,
    sprintIds: r.sprintIds ?? [],
    storyPoints: r.storyPoints ?? null,
    labels: r.labels ?? [],
    epicKey: r.epicKey ?? null,
    parentKey: r.parentKey ?? null,
    created,
    updated: toDate(r.updated) ?? lastChange ?? created,
    resolved: toDate(r.resolved),
    dueDate: toDate(r.dueDate),
    changelog,
  }
}

function buildTransitions(issues: Issue[]): Transition[] {
  const out: Transition[] = []
  for (const issue of issues) {
    let prevAt = issue.created
    for (const c of issue.changelog) {
      if (c.field !== "status" || c.to === null) continue
      out.push({
        issueKey: issue.key,
        at: c.at,
        authorId: c.authorId,
        from: c.from,
        to: c.to,
        msInPrevious: Math.max(0, c.at.getTime() - prevAt.getTime()),
      })
      prevAt = c.at
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/** Any person id referenced but not defined becomes "Unknown (<id>)". */
function synthesiseMissingPeople(people: Person[], teams: Team[], issues: Issue[]) {
  const known = new Set(people.map((p) => p.id))
  const add = (id: string | null) => {
    if (!id || known.has(id)) return
    known.add(id)
    people.push({ id, displayName: `Unknown (${id})`, email: null, avatarUrl: null })
  }
  for (const t of teams) t.memberIds.forEach(add)
  for (const i of issues) {
    add(i.assigneeId)
    add(i.reporterId)
    for (const c of i.changelog) {
      add(c.authorId)
      if (c.field === "assignee") {
        add(c.from)
        add(c.to)
      }
    }
  }
}

function collectStatuses(issues: Issue[]): StatusInfo[] {
  const seen = new Map<string, StatusCategory>()
  const note = (name: string | null, issue: Issue) => {
    if (name && !seen.has(name)) seen.set(name, categoryForStatus(name, issue))
  }
  for (const i of issues) {
    note(i.status, i)
    for (const c of i.changelog) {
      if (c.field !== "status") continue
      note(c.from, i)
      note(c.to, i)
    }
  }
  return [...seen.entries()]
    .sort(([a], [b]) => compareStatus(a, b))
    .map(([name, category]) => ({ name, category, colorVar: statusColorVar(name, category) }))
}

function toMeta(data: RawExport, issues: Issue[], teams: Team[], sprints: Sprint[]): Meta {
  const m = data.meta
  const latestUpdate = issues.reduce<Date | null>(
    (max, i) => (!max || i.updated > max ? i.updated : max),
    null,
  )
  return {
    source: m?.source ?? null,
    version: m?.version ?? null,
    generatedAt: toDate(m?.generatedAt) ?? latestUpdate ?? new Date(),
    jiraBaseUrl: m?.jiraBaseUrl ?? null,
    query: {
      teamIds: m?.query?.teamIds ?? teams.map((t) => t.id),
      sprintIds: m?.query?.sprintIds ?? sprints.map((s) => s.id),
    },
  }
}

/**
 * PIs sorted by start. Sprints without a known `piId` are assigned (mutated) to
 * the PI whose dates contain their start; a PI without a state gets one from
 * its dates vs `now`.
 */
function toProgramIncrements(data: RawExport, sprints: Sprint[], now: Date): ProgramIncrement[] {
  const pis = (data.programIncrements ?? [])
    .map(
      (p): ProgramIncrement => {
        const startDate = new Date(p.startDate)
        const endDate = new Date(p.endDate)
        return {
          id: p.id,
          name: p.name,
          startDate,
          endDate,
          state: p.state ?? (now < startDate ? "future" : now > endDate ? "closed" : "active"),
          objectives: p.objectives ?? [],
          sprintIds: [],
        }
      },
    )
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  const byId = new Map(pis.map((p) => [p.id, p]))
  for (const s of sprints) {
    if (s.piId && !byId.has(s.piId)) s.piId = null
    if (!s.piId && s.startDate) {
      const start = s.startDate
      s.piId = pis.find((p) => start >= p.startDate && start <= p.endDate)?.id ?? null
    }
    if (s.piId) byId.get(s.piId)!.sprintIds.push(s.id)
  }
  return pis
}
