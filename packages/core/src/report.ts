/**
 * Markdown report of the dashboard overview. Pure: dataset + options in,
 * Markdown text out. Every number comes from `metrics.ts`.
 */
import { format } from "date-fns"
import { CATEGORY_LABEL } from "./constants"
import {
  activitySummary,
  countByStatus,
  countByStatusCategory,
  cycleTimeDays,
  epicProgress,
  objectiveForecast,
  objectiveHealth,
  objectiveProgress,
  piHealth,
  piPredictability,
  remainingPoints,
  sprintHealth,
  sprintVelocity,
  timeInCurrentStatus,
  velocity,
  workloadByPerson,
  type ObjectiveHealthLevel,
} from "./metrics"
import {
  flowDistribution,
  flowEfficiency,
  flowItems,
  flowLoad,
  flowPredictability,
  flowTime,
  flowVelocity,
  HISTORY_LEVEL_LABEL,
  historyCoverage,
  sampleQuality,
  sizeMix,
  teamFlow,
  type Percentiles,
} from "./flow"
import { DEFAULT_FLOW_CONFIG, FLOW_TYPES, workingHoursLabel, type FlowConfig } from "./flowConfig"
import { periodLabel as labelForPeriod, periodRange, type DayRange, type Period } from "./period"
import { resolveScope, type Scope } from "./scope"
import type { DateRange, Issue, JiraDataset, Objective, Sprint, Transition } from "./types"

export type ReportSection = "summary" | "pi" | "objectives" | "flow" | "teams" | "sprints" | "status" | "people" | "movements"

export const REPORT_SECTIONS: { value: ReportSection; label: string; description: string }[] = [
  { value: "summary", label: "Summary", description: "Headline counts and activity in the period" },
  { value: "pi", label: "Program increment", description: "PI health, points per sprint and epic progress" },
  { value: "objectives", label: "Objectives", description: "PI objectives: business value, progress, health and forecast" },
  { value: "flow", label: "Flow", description: "The six flow metrics, in items and working time" },
  { value: "teams", label: "Teams", description: "Per-team tickets, remaining work and velocity" },
  { value: "sprints", label: "Sprints", description: "Sprint health, progress and scope" },
  { value: "status", label: "Status breakdown", description: "Tickets in each workflow status" },
  { value: "people", label: "People", description: "Workload per assignee" },
  { value: "movements", label: "Movements", description: "Status moves, blocked tickets and recent activity" },
]

/** Empty `teamIds` / `sprintIds` = all (within the scope). Picked sprints replace the scope's. */
export type ReportOptions = {
  scope: Scope
  teamIds: string[]
  sprintIds: number[]
  period: Period
  /** The picked days when `period` is "custom". */
  customDates?: DayRange | null
  sections: ReportSection[]
  /** The active flow settings; the defaults when left out. */
  flowConfig?: FlowConfig
}

const HEALTH_LABEL: Record<ObjectiveHealthLevel, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  completed: "Completed",
  no_data: "No tickets",
}

const RECENT_MOVES = 15
const DAY_MS = 86_400_000

const byTeams = (sprints: Sprint[], teamIds: string[]) =>
  teamIds.length ? sprints.filter((s) => s.teamId && teamIds.includes(s.teamId)) : sprints

/** Sprints a user can pick for a report: the scope's PI (all sprints without PIs), for the selected teams. */
export function reportSprints(dataset: JiraDataset, scope: Scope, teamIds: string[]): Sprint[] {
  return byTeams(resolveScope(dataset, scope).historySprints, teamIds)
}

/** Everything the report is computed from, scoped to the options (mirrors the dashboard's hooks). */
export function reportScope(dataset: JiraDataset, options: ReportOptions) {
  const { teamIds, sprintIds, period } = options
  const resolved = resolveScope(dataset, options.scope)
  const sprints = (
    sprintIds.length ? dataset.sprints.filter((s) => sprintIds.includes(s.id)) : byTeams(resolved.sprints, teamIds)
  ).sort((a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity))
  const ticketSprintIds = new Set(sprints.map((s) => s.id))
  // History views (velocity, PI progress) pick each sprint's tickets themselves.
  const historyIssues = dataset.issues.filter((i) => !teamIds.length || (i.teamId !== null && teamIds.includes(i.teamId)))
  const issues = historyIssues.filter(
    (i) => (!sprintIds.length && dataset.sprints.length === 0) || i.sprintIds.some((id) => ticketSprintIds.has(id)),
  )
  const keys = new Set(issues.map((i) => i.key))
  const transitions = dataset.transitions.filter((t) => keys.has(t.issueKey))
  const now = dataset.meta.generatedAt
  const range = periodRange(period, now, sprints, issues, resolved.pi, options.customDates ?? null)
  const teams = teamIds.length ? dataset.teams.filter((t) => teamIds.includes(t.id)) : dataset.teams
  const historySprints = byTeams(resolved.historySprints, teamIds)
  return { issues, historyIssues, transitions, sprints, historySprints, teams, range, now, resolved, pickedSprintIds: sprintIds }
}

export function buildReport(dataset: JiraDataset, options: ReportOptions): string {
  const scope = reportScope(dataset, options)
  const periodLabel = labelForPeriod(options.period, scope.range)
  const ctx = { dataset, ...scope, periodLabel, cfg: options.flowConfig ?? DEFAULT_FLOW_CONFIG }
  const want = new Set(options.sections)
  const { resolved } = scope

  const teamNames = options.teamIds.length ? scope.teams.map((t) => t.name).join(", ") : "All teams"
  const sprintNames = options.sprintIds.length
    ? options.sprintIds.map((id) => dataset.sprintById.get(id)?.name ?? `#${id}`).join(", ")
    : resolved.kind === "pi"
      ? `All sprints in ${resolved.label}`
      : "Current sprint"

  const out: string[] = [
    `# ${resolved.kind === "pi" ? `${resolved.label} report` : "Sprint report"}: ${teamNames}`,
    "",
    `_Data exported ${formatDateTime(dataset.meta.generatedAt)}${dataset.meta.source ? ` from ${dataset.meta.source}` : ""}._`,
    "",
    ...(resolved.pi ? [`- **PI:** ${resolved.pi.name} (${formatRange({ start: resolved.pi.startDate, end: resolved.pi.endDate })})`] : []),
    `- **Teams:** ${teamNames}`,
    `- **Sprints:** ${sprintNames}`,
    `- **Period:** ${periodLabel} (${formatRange(scope.range)})`,
    "",
  ]

  if (want.has("summary")) out.push(...summarySection(ctx))
  if (want.has("pi")) out.push(...piSection(ctx))
  if (want.has("objectives")) out.push(...objectivesSection(ctx))
  if (want.has("flow")) out.push(...flowSection(ctx))
  if (want.has("teams")) out.push(...teamsSection(ctx))
  if (want.has("sprints")) out.push(...sprintsSection(ctx))
  if (want.has("status")) out.push(...statusSection(ctx))
  if (want.has("people")) out.push(...peopleSection(ctx))
  if (want.has("movements")) out.push(...movementsSection(ctx))

  return `${out.join("\n").trimEnd()}\n`
}

type Ctx = ReturnType<typeof reportScope> & { dataset: JiraDataset; periodLabel: string; cfg: FlowConfig }

function summarySection({ issues, transitions, range, periodLabel }: Ctx): string[] {
  const counts = countByStatusCategory(issues)
  const activity = activitySummary(issues, transitions, range)
  const cycle = avgCycleTime(issues.filter((i) => i.resolved && i.resolved >= range.start && i.resolved <= range.end))
  return [
    "## Summary",
    "",
    table(
      ["Metric", "Value"],
      [
        ["Tickets", String(counts.total)],
        [CATEGORY_LABEL.todo, String(counts.todo)],
        [CATEGORY_LABEL.in_progress, String(counts.in_progress)],
        [CATEGORY_LABEL.done, String(counts.done)],
        ["Remaining work", `${remainingPoints(issues)} pts`],
        [`Created (${periodLabel})`, String(activity.created)],
        [`Resolved (${periodLabel})`, String(activity.resolved)],
        [`Status moves (${periodLabel})`, String(activity.moves)],
        [`Newly blocked (${periodLabel})`, String(activity.blocked)],
        [`Avg cycle time (${periodLabel})`, cycle === null ? "—" : `${cycle.toFixed(1)} days`],
      ],
    ),
    "",
  ]
}

function piSection({ dataset, resolved, historySprints, historyIssues, now }: Ctx): string[] {
  const pi = resolved.pi
  const out = ["## Program increment", ""]
  if (!pi) return [...out, "_This export has no program increments._", ""]
  const scoped = { ...pi, sprintIds: historySprints.map((s) => s.id) }
  const health = piHealth(scoped, historyIssues, now)
  out.push(
    `**${pi.name}**: ${HEALTH_LABEL[health.level]}. ${health.pctDone}% of points done with ${health.pctElapsed}% of the PI gone (${health.donePoints} / ${health.totalPoints} pts, ${health.ticketCount} tickets${pi.state === "active" ? `, ${health.daysLeft} days left` : ""}).`,
    "",
  )
  if (pi.objectives.length) out.push("**Objectives**", "", ...pi.objectives.map((o) => `- ${inline(o.title)}`), "")

  const started = historySprints.filter((s) => s.state !== "future" && s.startDate)
  if (started.length) {
    out.push(
      "### Points per sprint",
      "",
      table(
        ["Sprint", "Team", "State", "Committed", "Completed"],
        started.map((s) => {
          const v = sprintVelocity(s, historyIssues)
          return [s.name, (s.teamId && dataset.teamById.get(s.teamId)?.name) || "—", s.state, `${v.committed} pts`, `${v.completed} pts`]
        }),
      ),
      "",
    )
  }

  const ids = new Set(scoped.sprintIds)
  const epics = epicProgress(historyIssues.filter((i) => i.sprintIds.some((id) => ids.has(id))))
  out.push("### Epics", "")
  if (!epics.length) return [...out, "_No tickets in this PI are linked to an epic._", ""]
  out.push(
    table(
      ["Epic", "Team", "Done", "Tickets", "Points"],
      epics.map((e) => [
        `${dataset.byKey.get(e.epicKey)?.summary ?? e.epicKey} (${ticketRef(dataset, e.epicKey)})`,
        e.teamIds.map((id) => dataset.teamById.get(id)?.name ?? id).join(", ") || "—",
        `${e.pctDone}%`,
        `${e.done} / ${e.total}`,
        `${e.donePoints} / ${e.points}`,
      ]),
    ),
    "",
  )
  return out
}

/** Same rules as the Objectives page: picked sprints narrow the tickets; a team filter hides other teams' objectives. */
function objectivesSection({ resolved, historyIssues, teams, now, pickedSprintIds }: Ctx): string[] {
  const pi = resolved.pi
  const out = [`## Objectives${pi ? ` (${pi.name})` : ""}`, ""]
  if (!pi) return [...out, "_This export has no program increments._", ""]
  const teamIds = new Set(teams.map((t) => t.id))
  const shown = pi.objectives.filter((o) => o.teamId === null || teamIds.has(o.teamId))
  if (!shown.length) return [...out, "_No objectives for this PI._", ""]

  const issues = pickedSprintIds.length
    ? historyIssues.filter((i) => i.sprintIds.some((id) => pickedSprintIds.includes(id)))
    : historyIssues
  const predictability = piPredictability(shown)
  out.push(
    predictability
      ? `**Predictability:** ${predictability.pct}% (${predictability.actual} of ${predictability.planned} planned business value).`
      : `**Predictability:** ${pi.state === "closed" ? "no business values assessed" : "assessed when the PI ends"}.`,
    "",
  )

  const rowsFor = (list: Objective[]) =>
    table(
      ["Objective", "Commitment", "BV planned / actual", "Done", "Health", pi.state === "closed" ? "Finished" : "Forecast"],
      list.map((o) => {
        const forecast = objectiveForecast(o, pi, issues, now)
        return [
          o.title,
          o.committed ? "Committed" : "Uncommitted",
          `${o.plannedBusinessValue ?? "—"} / ${o.actualBusinessValue ?? "—"}`,
          `${objectiveProgress(o, pi, issues).pctDone}%`,
          HEALTH_LABEL[objectiveHealth(o, pi, issues, now).level],
          forecast === null ? "—" : `${forecast}%`,
        ]
      }),
    )
  for (const team of teams) {
    const list = shown.filter((o) => o.teamId === team.id)
    if (list.length) out.push(`### ${team.name}`, "", rowsFor(list), "")
  }
  const art = shown.filter((o) => o.teamId === null)
  if (art.length) out.push("### ART level", "", rowsFor(art), "")
  return out
}

const AGING_LISTED = 10

/** Same tickets as the Flow page (scope's PI sprints or picked sprints, team filter), in working hours. */
function flowSection({ dataset, historyIssues, historySprints, pickedSprintIds, teams, range, now, periodLabel, cfg }: Ctx): string[] {
  const sprints = pickedSprintIds.length ? dataset.sprints.filter((s) => pickedSprintIds.includes(s.id)) : historySprints
  const ids = new Set(sprints.map((s) => s.id))
  const items = flowItems(dataset.sprints.length ? historyIssues.filter((i) => i.sprintIds.some((id) => ids.has(id))) : historyIssues, cfg)
  const opts = { mode: "working" as const, now, cfg }
  const velocity = flowVelocity(items, range, cfg)
  const time = flowTime(items, range, opts)
  const load = flowLoad(items, range, opts)
  const efficiency = flowEfficiency(items, range, opts)
  const dist = flowDistribution(items, sprints, range, opts)
  const predictability = flowPredictability(dataset.programIncrements)
  const size = sizeMix(items, range, cfg)
  const history = historyCoverage(items, now, cfg)
  const n = time.points.length
  const quality = sampleQuality(n)
  const members = teams.reduce((sum, t) => sum + t.memberIds.length, 0)
  const d = (x: number | null) => (x === null ? "—" : x.toFixed(1))
  const pcts = (p: Percentiles) => `p50 ${d(p.p50)} · p85 ${d(p.p85)} · p95 ${d(p.p95)} working days (n ${n})`

  const out = [
    "## Flow",
    "",
    `_Items, not points. Period: ${periodLabel}. Times are in working hours (${workingHoursLabel(cfg.workingHours)}; a working day is ${cfg.workingHours.end - cfg.workingHours.start} hours). History: ${history.weeks} weeks, ${HISTORY_LEVEL_LABEL[history.level].toLowerCase()}._`,
    "",
    ...(quality.note && quality.level !== "none" ? [`> ${quality.note}`, ""] : []),
    table(
      ["Metric", "Value"],
      [
        ["Flow time (created → done)", n ? pcts(time.lead) : "—"],
        ["Cycle time (work started → done)", n ? pcts(time.cycle) : "—"],
        [
          "Load",
          `${load.wipNow} in progress, average age ${d(load.avgAgeDays)} working days${members ? ` (${(load.wipNow / members).toFixed(1)} per team member)` : ""}`,
        ],
        [
          "Velocity",
          `${velocity.total} items (${velocity.delta >= 0 ? "+" : ""}${velocity.delta} vs the previous period; counted regardless of size${size.median === null ? "" : `, median ${size.median} pts`})`,
        ],
        ["Efficiency", efficiency.pct === null ? "—" : `${efficiency.pct}%`],
        ["Distribution (finished)", FLOW_TYPES.map((t) => `${t} ${dist.finished[t]}`).join(" · ")],
        ["Distribution (in progress)", FLOW_TYPES.map((t) => `${t} ${dist.wip[t]}`).join(" · ")],
        [
          "Predictability",
          predictability.length ? predictability.map((p) => `${p.name}: ${p.pct === null ? "pending" : `${p.pct}%`}`).join(" · ") : "no PIs in this export",
        ],
      ],
    ),
    "",
  ]
  const perTeam = teamFlow(items, teams, range, opts, "created").filter((t) => t.velocity || t.wip)
  if (perTeam.length > 1) {
    out.push(
      "### Teams",
      "",
      table(
        ["Team", "Finished", "Flow time p50 / p85", "In progress", "Per member", "Efficiency"],
        perTeam.map((t) => [
          t.name,
          String(t.velocity),
          `${d(t.flowTime.p50)} / ${d(t.flowTime.p85)} wd (n ${t.flowTime.n})`,
          String(t.wip),
          t.wipPerMember === null ? "—" : t.wipPerMember.toFixed(1),
          t.efficiency === null ? "—" : `${t.efficiency}%`,
        ]),
      ),
      "",
      "_Team-level system measures, for finding where work gets stuck; not for rating individuals._",
      "",
    )
  }
  // Aging compares age since work started with cycle time, so like is compared with like.
  const p85 = time.cycle.p85
  const drifting = p85 === null ? [] : load.aging.filter((a) => a.ageDays > p85).sort((a, b) => b.ageDays - a.ageDays)
  if (drifting.length) {
    out.push(
      `### In progress longer than 85% of finished items' cycle time (${d(p85)} working days)`,
      "",
      table(
        ["Ticket", "Summary", "Status", "Age"],
        drifting.slice(0, AGING_LISTED).map((a) => [ticketRef(dataset, a.key), a.summary, a.status, `${d(a.ageDays)} wd`]),
      ),
      "",
    )
  }
  return out
}

function teamsSection({ teams, issues, historyIssues, historySprints, transitions, range, periodLabel }: Ctx): string[] {
  const out = ["## Teams", ""]
  if (!teams.length) return [...out, "_No teams in scope._", ""]
  for (const team of teams) {
    const teamIssues = issues.filter((i) => i.teamId === team.id)
    const keys = new Set(teamIssues.map((i) => i.key))
    const counts = countByStatusCategory(teamIssues)
    const activity = activitySummary(teamIssues, transitions.filter((t) => keys.has(t.issueKey)), range)
    const vel = velocity(team, historySprints, historyIssues.filter((i) => i.teamId === team.id))
    const avg = vel.length ? Math.round(vel.reduce((s, v) => s + v.completed, 0) / vel.length) : null
    out.push(
      `### ${team.name}${team.projectKey ? ` (${team.projectKey})` : ""}`,
      "",
      `- **Members:** ${team.memberIds.length}`,
      `- **Tickets:** ${counts.total} (${counts.todo} to do · ${counts.in_progress} in progress · ${counts.done} done)`,
      `- **Remaining:** ${remainingPoints(teamIssues)} pts`,
      `- **Avg velocity:** ${avg === null ? "—" : `${avg} pts over ${vel.length} closed sprint${vel.length === 1 ? "" : "s"}`}`,
      `- **${periodLabel}:** ${activity.moves} moves · ${activity.created} created · ${activity.resolved} done · ${activity.blocked} blocked`,
      "",
    )
    if (vel.length) {
      out.push(
        table(
          ["Sprint", "Committed", "Completed"],
          vel.map((v) => [v.sprintName, `${v.committed} pts`, `${v.completed} pts`]),
        ),
        "",
      )
    }
  }
  return out
}

function sprintsSection({ dataset, sprints, issues, now }: Ctx): string[] {
  const out = ["## Sprints", ""]
  if (!sprints.length) return [...out, "_No sprints in scope._", ""]
  out.push(
    table(
      ["Sprint", "Team", "State", "Dates", "Health", "Done", "Elapsed", "Points", "Days left"],
      sprints.map((s) => {
        const h = sprintHealth(s, issues, now)
        return [
          s.name,
          (s.teamId && dataset.teamById.get(s.teamId)?.name) || "—",
          s.state,
          s.startDate && s.endDate ? formatRange({ start: s.startDate, end: s.endDate }) : "—",
          s.state === "future" ? "Planned" : HEALTH_LABEL[h.level],
          `${h.pctDone}%`,
          `${h.pctElapsed}%`,
          `${h.donePoints} / ${h.totalPoints}`,
          s.state === "active" ? String(h.daysLeft) : "—",
        ]
      }),
    ),
    "",
  )
  const goals = sprints.filter((s) => s.goal)
  if (goals.length) out.push("**Goals**", "", ...goals.map((s) => `- **${s.name}:** ${inline(s.goal!)}`), "")
  return out
}

function statusSection({ issues }: Ctx): string[] {
  const out = ["## Status breakdown", ""]
  if (!issues.length) return [...out, "_No tickets in scope._", ""]
  const byCategory = new Map(issues.map((i) => [i.status, i.statusCategory]))
  out.push(
    table(
      ["Status", "Category", "Tickets", "Share"],
      countByStatus(issues).map((s) => [
        s.status,
        CATEGORY_LABEL[byCategory.get(s.status)!],
        String(s.count),
        `${Math.round((s.count / issues.length) * 100)}%`,
      ]),
    ),
    "",
  )
  return out
}

function peopleSection({ dataset, issues }: Ctx): string[] {
  const out = ["## People", ""]
  const workload = workloadByPerson(issues)
  if (!workload.length) return [...out, "_No tickets in scope._", ""]
  out.push(
    table(
      ["Person", "To do", "In progress", "Done", "Open points"],
      workload.map((w) => [
        personName(dataset, w.personId),
        String(w.todo),
        String(w.in_progress),
        String(w.done),
        String(w.openPoints),
      ]),
    ),
    "",
  )
  return out
}

function movementsSection({ dataset, issues, transitions, range, now, periodLabel }: Ctx): string[] {
  const moves = transitions.filter((t) => t.at >= range.start && t.at <= range.end)
  const out = [`## Movements (${periodLabel})`, ""]

  if (moves.length) {
    const byStatus = new Map<string, number>()
    for (const t of moves) byStatus.set(t.to, (byStatus.get(t.to) ?? 0) + 1)
    out.push(
      table(
        ["Moved to", "Moves"],
        [...byStatus.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => [s, String(n)]),
      ),
      "",
      `**Most recent ${Math.min(RECENT_MOVES, moves.length)} of ${moves.length}**`,
      "",
      table(
        ["When", "Ticket", "Move", "By"],
        moves
          .slice(-RECENT_MOVES)
          .reverse()
          .map((t: Transition) => [
            formatDateTime(t.at),
            ticketRef(dataset, t.issueKey),
            `${t.from ?? "—"} → ${t.to}`,
            t.authorId ? personName(dataset, t.authorId) : "—",
          ]),
      ),
      "",
    )
  } else {
    out.push("_No status moves in this period._", "")
  }

  const blocked = issues.filter((i) => i.status === "Blocked")
  out.push("### Currently blocked", "")
  if (!blocked.length) return [...out, "_Nothing is blocked._", ""]
  out.push(
    table(
      ["Ticket", "Summary", "Assignee", "Blocked for"],
      blocked
        .map((i) => ({ i, ms: timeInCurrentStatus(i, now) }))
        .sort((a, b) => b.ms - a.ms)
        .map(({ i, ms }) => [
          ticketRef(dataset, i.key),
          i.summary,
          personName(dataset, i.assigneeId),
          `${Math.floor(ms / DAY_MS)}d`,
        ]),
    ),
    "",
  )
  return out
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function avgCycleTime(issues: Issue[]): number | null {
  const times = issues.map(cycleTimeDays).filter((d): d is number => d !== null)
  return times.length ? times.reduce((s, d) => s + d, 0) / times.length : null
}

function personName(dataset: JiraDataset, id: string | null): string {
  if (id === null) return "Unassigned"
  return dataset.personById.get(id)?.displayName ?? id
}

function ticketRef(dataset: JiraDataset, key: string): string {
  const base = dataset.meta.jiraBaseUrl?.replace(/\/$/, "")
  return base ? `[${key}](${base}/browse/${key})` : key
}

const formatDateTime = (d: Date) => format(d, "d MMM yyyy, HH:mm")

function formatRange({ start, end }: DateRange): string {
  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`
}

/** Collapse newlines so free text stays on one Markdown line. */
const inline = (s: string) => s.replace(/\s*\n\s*/g, " ").trim()

/** Escape a value for a Markdown table cell. */
export function cell(s: string): string {
  return inline(s).replace(/\|/g, "\\|")
}

function table(headers: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.map(cell).join(" | ")} |`
  return [line(headers), `|${headers.map(() => " --- ").join("|")}|`, ...rows.map(line)].join("\n")
}
