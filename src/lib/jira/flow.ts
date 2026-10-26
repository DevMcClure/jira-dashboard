/**
 * SAFe flow metrics, from the changelog. They count items and time, not story
 * points. Pure functions; settings in `flowConfig.ts`, time maths in
 * `working-time.ts`. See docs/plan-frontend.md → "Flow metrics research" and
 * docs/decisions/0007, 0014–0017.
 */
import { eachDayOfInterval, endOfDay, startOfDay, startOfWeek } from "date-fns"
import { compareStatus } from "./constants"
import { DEFAULT_FLOW_CONFIG, FLOW_TYPES, flowStateOf, flowTypeOf, isFlowItem, type FlowConfig, type FlowState, type FlowType } from "./flowConfig"
import { piPredictability, statusAt } from "./metrics"
import type { DateRange, Issue, ProgramIncrement, Sprint } from "./types"
import { elapsedMs, toDays, type TimeMode } from "./working-time"

export type FlowOptions = {
  mode: TimeMode
  /** The export's "now". */
  now: Date
  cfg?: FlowConfig
}

const inRange = (d: Date, r: DateRange) => d >= r.start && d <= r.end
const weekOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 })

/** Flow items: everything except containers (Epics) and parts (Sub-tasks), per the config. */
export function flowItems(issues: Issue[], cfg = DEFAULT_FLOW_CONFIG): Issue[] {
  return issues.filter((i) => isFlowItem(i, cfg))
}

// ---------------------------------------------------------------------------
// Per-item history
// ---------------------------------------------------------------------------

export type FlowSegment = { status: string; state: FlowState; from: Date; to: Date }

const statusChanges = (issue: Issue) => issue.changelog.filter((c) => c.field === "status" && c.to !== null)

/** Time spent in each status, from creation up to `now` (the last segment is still open). */
export function statusSegments(issue: Issue, now: Date, cfg = DEFAULT_FLOW_CONFIG): FlowSegment[] {
  const changes = statusChanges(issue)
  let status = changes.length ? (changes[0].from ?? "To Do") : issue.status
  let from = issue.created
  const out: FlowSegment[] = []
  const push = (to: Date) => {
    if (to > from) out.push({ status, state: flowStateOf(status, issue, cfg), from, to })
  }
  for (const c of changes) {
    const at = c.at < issue.created ? issue.created : c.at
    push(at)
    status = c.to!
    from = at
  }
  push(now)
  return out
}

/** When an item entered the workflow: its first move into an active status (else into waiting). */
export function flowStart(issue: Issue, cfg = DEFAULT_FLOW_CONFIG): Date | null {
  const changes = statusChanges(issue)
  const initial = changes.length ? (changes[0].from ?? "To Do") : issue.status
  const initialState = flowStateOf(initial, issue, cfg)
  if (initialState === "active" || initialState === "waiting") return issue.created
  const into = (state: FlowState) => changes.find((c) => flowStateOf(c.to!, issue, cfg) === state)?.at ?? null
  return into("active") ?? into("waiting")
}

/** The first time an item reached done (null if never). Velocity counts this. */
export function firstDone(issue: Issue, cfg = DEFAULT_FLOW_CONFIG): Date | null {
  const changes = statusChanges(issue)
  if (!changes.length) return flowStateOf(issue.status, issue, cfg) === "done" ? (issue.resolved ?? issue.created) : null
  return changes.find((c) => flowStateOf(c.to!, issue, cfg) === "done")?.at ?? null
}

/** The last time an item reached done, only if it's done now. Reopened items keep their first start and this end. */
export function flowEnd(issue: Issue, cfg = DEFAULT_FLOW_CONFIG): Date | null {
  if (flowStateOf(issue.status, issue, cfg) !== "done") return null
  const changes = statusChanges(issue)
  return changes.findLast((c) => flowStateOf(c.to!, issue, cfg) === "done")?.at ?? issue.resolved ?? issue.created
}

/** Active vs waiting time between start and end (or now). Not-started or done time in between counts as waiting. */
export function activeWaiting(issue: Issue, opts: FlowOptions) {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  const start = flowStart(issue, cfg)
  const end = flowEnd(issue, cfg) ?? opts.now
  let active = 0
  let waiting = 0
  const byStatus = new Map<string, { state: FlowState; ms: number }>()
  if (start) {
    for (const s of statusSegments(issue, opts.now, cfg)) {
      const from = s.from > start ? s.from : start
      const to = s.to < end ? s.to : end
      if (to <= from) continue
      const ms = elapsedMs(from, to, opts.mode, cfg.workingHours)
      if (s.state === "active") active += ms
      else waiting += ms
      const prev = byStatus.get(s.status)
      byStatus.set(s.status, { state: s.state, ms: (prev?.ms ?? 0) + ms })
    }
  }
  return { active, waiting, byStatus }
}

// ---------------------------------------------------------------------------
// The six metrics
// ---------------------------------------------------------------------------

/** Nearest-rank percentile (the smallest value with at least p% of values at or below it). Null for no values. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]
}

export type Percentiles = { p50: number | null; p85: number | null; p95: number | null }
const percentiles = (values: number[]): Percentiles => ({
  p50: percentile(values, 50),
  p85: percentile(values, 85),
  p95: percentile(values, 95),
})

export type WeekCount = { week: Date; count: number }

/** Flow Velocity: items first done in the range, per week, with the previous equal-length period for a delta. */
export function flowVelocity(items: Issue[], range: DateRange, cfg = DEFAULT_FLOW_CONFIG) {
  const length = range.end.getTime() - range.start.getTime()
  const previous: DateRange = { start: new Date(range.start.getTime() - length), end: new Date(range.start.getTime() - 1) }
  const firsts = items.map((i) => firstDone(i, cfg)).filter((d): d is Date => d !== null)
  const inPeriod = firsts.filter((d) => inRange(d, range))
  const weeks = new Map<number, number>()
  for (let w = weekOf(range.start); w <= range.end; w = new Date(w.getTime() + 7 * 86_400_000)) weeks.set(w.getTime(), 0)
  for (const d of inPeriod) {
    const k = weekOf(d).getTime()
    weeks.set(k, (weeks.get(k) ?? 0) + 1)
  }
  const prev = firsts.filter((d) => inRange(d, previous)).length
  return {
    total: inPeriod.length,
    previous: prev,
    delta: inPeriod.length - prev,
    perWeek: [...weeks.entries()].map(([w, count]): WeekCount => ({ week: new Date(w), count })),
  }
}

export type FlowTimePoint = { key: string; doneAt: Date; cycleDays: number; leadDays: number }

/**
 * Flow Time for items finished (last done) in the range. Cycle = flow start →
 * last done; lead = created → last done. In days of the chosen time mode.
 */
export function flowTime(items: Issue[], range: DateRange, opts: FlowOptions) {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  const days = (ms: number) => toDays(ms, opts.mode, cfg.workingHours)
  const points: FlowTimePoint[] = []
  for (const i of items) {
    const end = flowEnd(i, cfg)
    if (!end || !inRange(end, range)) continue
    const start = flowStart(i, cfg) ?? end
    points.push({
      key: i.key,
      doneAt: end,
      cycleDays: days(elapsedMs(start, end, opts.mode, cfg.workingHours)),
      leadDays: days(elapsedMs(i.created, end, opts.mode, cfg.workingHours)),
    })
  }
  points.sort((a, b) => a.doneAt.getTime() - b.doneAt.getTime())
  return {
    points,
    cycle: percentiles(points.map((p) => p.cycleDays)),
    lead: percentiles(points.map((p) => p.leadDays)),
  }
}

export type AgingItem = { key: string; summary: string; status: string; state: FlowState; ageDays: number }

/**
 * Flow Load: items in an active or waiting state at the end of each day in the
 * range (changelog replay), and the age of each one still open now.
 */
export function flowLoad(items: Issue[], range: DateRange, opts: FlowOptions) {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  const inFlow = (s: FlowState) => s === "active" || s === "waiting"
  const daily = eachDayOfInterval({ start: startOfDay(range.start), end: startOfDay(range.end) }).map((date) => {
    const at = endOfDay(date) < opts.now ? endOfDay(date) : opts.now
    let active = 0
    let waiting = 0
    for (const i of items) {
      const status = statusAt(i, at)
      if (status === null) continue
      const state = flowStateOf(status, i, cfg)
      if (state === "active") active++
      else if (state === "waiting") waiting++
    }
    return { date, wip: active + waiting, active, waiting }
  })
  const aging: AgingItem[] = items
    .map((i) => ({ i, state: flowStateOf(i.status, i, cfg) }))
    .filter(({ state }) => inFlow(state))
    .map(({ i, state }) => ({
      key: i.key,
      summary: i.summary,
      status: i.status,
      state,
      ageDays: toDays(elapsedMs(flowStart(i, cfg) ?? i.created, opts.now, opts.mode, cfg.workingHours), opts.mode, cfg.workingHours),
    }))
    .sort((a, b) => compareStatus(a.status, b.status) || b.ageDays - a.ageDays)
  const avgAgeDays = aging.length ? aging.reduce((s, a) => s + a.ageDays, 0) / aging.length : null
  return { daily, aging, wipNow: aging.length, avgAgeDays }
}

/**
 * Flow Efficiency over items finished in the range: Σ active ÷ Σ (active +
 * waiting), an aggregate rather than an average of per-item ratios. Also per
 * week (by finish week) and the time spent in each status ("where the time goes").
 */
export function flowEfficiency(items: Issue[], range: DateRange, opts: FlowOptions) {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  const days = (ms: number) => toDays(ms, opts.mode, cfg.workingHours)
  let active = 0
  let waiting = 0
  const weeks = new Map<number, { active: number; waiting: number; items: number }>()
  for (let w = weekOf(range.start); w <= range.end; w = new Date(w.getTime() + 7 * 86_400_000)) {
    weeks.set(w.getTime(), { active: 0, waiting: 0, items: 0 })
  }
  const byStatus = new Map<string, { state: FlowState; ms: number }>()
  for (const i of items) {
    const end = flowEnd(i, cfg)
    if (!end || !inRange(end, range)) continue
    const t = activeWaiting(i, opts)
    active += t.active
    waiting += t.waiting
    const w = weeks.get(weekOf(end).getTime())
    if (w) {
      w.active += t.active
      w.waiting += t.waiting
      w.items++
    }
    for (const [status, v] of t.byStatus) {
      const prev = byStatus.get(status)
      byStatus.set(status, { state: v.state, ms: (prev?.ms ?? 0) + v.ms })
    }
  }
  const pct = (a: number, w: number) => (a + w > 0 ? Math.round((a / (a + w)) * 100) : null)
  return {
    pct: pct(active, waiting),
    activeDays: days(active),
    waitingDays: days(waiting),
    perWeek: [...weeks.entries()].map(([w, v]) => ({ week: new Date(w), pct: pct(v.active, v.waiting), items: v.items })),
    byStatus: [...byStatus.entries()]
      .sort(([a], [b]) => compareStatus(a, b))
      .map(([status, v]) => ({ status, state: v.state, days: days(v.ms) })),
  }
}

export type TypeCounts = Record<FlowType, number>
const emptyCounts = (): TypeCounts => Object.fromEntries(FLOW_TYPES.map((t) => [t, 0])) as TypeCounts

/**
 * Flow Distribution: per started sprint, items done by its end (or now) by flow
 * type; plus the mix of items finished in the range and of the current WIP.
 */
export function flowDistribution(items: Issue[], sprints: Sprint[], range: DateRange, opts: FlowOptions) {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  const perSprint = sprints
    .filter((s) => s.state !== "future" && s.startDate)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
    .map((s) => {
      const sprintEnd = s.completeDate ?? s.endDate ?? opts.now
      const at = sprintEnd < opts.now ? sprintEnd : opts.now
      const counts = emptyCounts()
      for (const i of items) {
        if (!i.sprintIds.includes(s.id)) continue
        const status = statusAt(i, at)
        if (status !== null && flowStateOf(status, i, cfg) === "done") counts[flowTypeOf(i, cfg)]++
      }
      return { sprintId: s.id, name: s.name, counts, total: FLOW_TYPES.reduce((n, t) => n + counts[t], 0) }
    })
  const finished = emptyCounts()
  const wip = emptyCounts()
  for (const i of items) {
    const end = flowEnd(i, cfg)
    if (end && inRange(end, range)) finished[flowTypeOf(i, cfg)]++
    const state = flowStateOf(i.status, i, cfg)
    if (state === "active" || state === "waiting") wip[flowTypeOf(i, cfg)]++
  }
  return { perSprint, finished, wip }
}

/** Flow Predictability per PI (from F1's objectives); null until a PI's committed objectives are assessed. */
export function flowPredictability(pis: ProgramIncrement[]) {
  return pis.map((p) => ({ piId: p.id, name: p.name, state: p.state, pct: piPredictability(p.objectives)?.pct ?? null }))
}
