/**
 * SAFe flow metrics, from the changelog. They count items and time, not story
 * points. Pure functions; settings in `flowConfig.ts`, time maths in
 * `working-time.ts`. See docs/plan-frontend.md → "Flow metrics research" and
 * docs/decisions/0007, 0014–0017.
 */
import { eachDayOfInterval, eachWeekOfInterval, endOfDay, endOfWeek, startOfDay, startOfWeek } from "date-fns"
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
/** Local Monday-start weeks covering the range. Calendar-aware, so weeks stay aligned across clock changes. */
const weeksOf = (r: DateRange) => (r.end < r.start ? [] : eachWeekOfInterval({ start: r.start, end: r.end }, { weekStartsOn: 1 }))

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
  for (const w of weeksOf(range)) weeks.set(w.getTime(), 0)
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
  for (const w of weeksOf(range)) weeks.set(w.getTime(), { active: 0, waiting: 0, items: 0 })
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

// ---------------------------------------------------------------------------
// Refinements (docs/decisions/0022–0024)
// ---------------------------------------------------------------------------

/**
 * Where Flow Time starts. "created" = when the item entered the backlog (lead
 * time; the DX article's definition), "started" = its first move into an
 * active status (cycle time). Both end at the last move into done.
 */
export type FlowTimeBasis = "created" | "started"

export const FLOW_TIME_BASIS_LABEL: Record<FlowTimeBasis, string> = {
  created: "From created",
  started: "From work started",
}

export function flowTimeDays(point: FlowTimePoint, basis: FlowTimeBasis): number {
  return basis === "created" ? point.leadDays : point.cycleDays
}

/** The percentiles for a basis, from `flowTime`'s result. */
export function flowTimePercentiles(time: ReturnType<typeof flowTime>, basis: FlowTimeBasis): Percentiles {
  return basis === "created" ? time.lead : time.cycle
}

export type WeekFlowTime = { week: Date; count: number; p50: number | null; p85: number | null }

/** Flow time per finish week (p50 / p85 of items finished that week), for the speed-vs-throughput trend. */
export function flowTimeByWeek(items: Issue[], range: DateRange, opts: FlowOptions, basis: FlowTimeBasis): WeekFlowTime[] {
  const byWeek = new Map<number, number[]>(weeksOf(range).map((w) => [w.getTime(), []]))
  for (const p of flowTime(items, range, opts).points) byWeek.get(weekOf(p.doneAt).getTime())?.push(flowTimeDays(p, basis))
  return [...byWeek.entries()].map(([w, values]) => ({
    week: new Date(w),
    count: values.length,
    p50: percentile(values, 50),
    p85: percentile(values, 85),
  }))
}

export type WeekLoad = { week: Date; avgWip: number; throughput: number; flowTimeP85: number | null }

/**
 * Per week: average end-of-day WIP, items finished (first done) and flow time
 * p85, for finding the WIP level where throughput peaks while flow time stays steady.
 */
export function weeklyLoad(items: Issue[], range: DateRange, opts: FlowOptions, basis: FlowTimeBasis): WeekLoad[] {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  const wip = new Map<number, number[]>()
  for (const d of flowLoad(items, range, opts).daily) {
    const k = weekOf(d.date).getTime()
    wip.set(k, [...(wip.get(k) ?? []), d.wip])
  }
  const throughput = new Map(flowVelocity(items, range, cfg).perWeek.map((w) => [w.week.getTime(), w.count]))
  const time = new Map(flowTimeByWeek(items, range, opts, basis).map((w) => [w.week.getTime(), w.p85]))
  return weeksOf(range)
    .filter((w) => wip.has(w.getTime()))
    .map((w) => {
      const days = wip.get(w.getTime())!
      return {
        week: w,
        avgWip: days.reduce((s, n) => s + n, 0) / days.length,
        throughput: throughput.get(w.getTime()) ?? 0,
        flowTimeP85: time.get(w.getTime()) ?? null,
      }
    })
}

export type TeamFlow = {
  teamId: string
  name: string
  members: number
  velocity: number
  flowTime: Percentiles & { n: number }
  wip: number
  /** WIP divided by team size; null for a team with no members listed. */
  wipPerMember: number | null
  efficiency: number | null
  finished: TypeCounts
}

/** The flow metrics per team. Team level only: flow measures the system, not individuals (decision 0024). */
export function teamFlow(
  items: Issue[],
  teams: { id: string; name: string; memberIds: string[] }[],
  range: DateRange,
  opts: FlowOptions,
  basis: FlowTimeBasis,
): TeamFlow[] {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  return teams.map((t) => {
    const own = items.filter((i) => i.teamId === t.id)
    const times = flowTime(own, range, opts).points.map((p) => flowTimeDays(p, basis))
    const wip = own.filter((i) => {
      const s = flowStateOf(i.status, i, cfg)
      return s === "active" || s === "waiting"
    }).length
    const finished = emptyCounts()
    for (const i of own) {
      const end = flowEnd(i, cfg)
      if (end && inRange(end, range)) finished[flowTypeOf(i, cfg)]++
    }
    return {
      teamId: t.id,
      name: t.name,
      members: t.memberIds.length,
      velocity: flowVelocity(own, range, cfg).total,
      flowTime: { ...percentiles(times), n: times.length },
      wip,
      wipPerMember: t.memberIds.length ? wip / t.memberIds.length : null,
      efficiency: flowEfficiency(own, range, opts).pct,
      finished,
    }
  })
}

/** Story-point sizes shown as their own bucket; anything else is "Other". */
export const SIZE_BUCKETS = ["1", "2", "3", "5", "8", "13", "Other", "Unestimated"] as const
export type SizeBucket = (typeof SIZE_BUCKETS)[number]

const median = (values: number[]) => {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Size of items finished (last done) in the range, by story points, with the
 * median now and in the previous equal-length period. Velocity counts items
 * regardless of size; this shows whether the size of work is shifting.
 */
export function sizeMix(items: Issue[], range: DateRange, cfg = DEFAULT_FLOW_CONFIG) {
  const length = range.end.getTime() - range.start.getTime()
  const previous: DateRange = { start: new Date(range.start.getTime() - length), end: new Date(range.start.getTime() - 1) }
  const finishedIn = (r: DateRange) =>
    items.filter((i) => {
      const end = flowEnd(i, cfg)
      return end !== null && inRange(end, r)
    })
  const counts = new Map<SizeBucket, number>(SIZE_BUCKETS.map((b) => [b, 0]))
  const now = finishedIn(range)
  for (const i of now) {
    const p = i.storyPoints
    const bucket: SizeBucket = p === null ? "Unestimated" : (SIZE_BUCKETS as readonly string[]).includes(String(p)) ? (String(p) as SizeBucket) : "Other"
    counts.set(bucket, counts.get(bucket)! + 1)
  }
  const estimated = (list: Issue[]) => list.map((i) => i.storyPoints).filter((p): p is number => p !== null)
  return {
    buckets: SIZE_BUCKETS.map((size) => ({ size, count: counts.get(size)! })),
    finished: now.length,
    unestimated: counts.get("Unestimated")!,
    median: median(estimated(now)),
    previousMedian: median(estimated(finishedIn(previous))),
  }
}

export type HistoryLevel = "too-early" | "early" | "emerging" | "established"

export const HISTORY_LEVEL_LABEL: Record<HistoryLevel, string> = {
  "too-early": "Too early",
  early: "Early insights",
  emerging: "Patterns emerging",
  established: "Established",
}

/**
 * How much flow history the items cover: whole weeks since the earliest flow
 * start, and items finished. Levels follow the DX guidance: initial insights
 * within 2–4 weeks, actionable patterns after 2–3 months (decision 0023).
 */
export function historyCoverage(items: Issue[], now: Date, cfg = DEFAULT_FLOW_CONFIG) {
  const starts = items.map((i) => flowStart(i, cfg)).filter((d): d is Date => d !== null && d <= now)
  const earliest = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null
  const weeks = earliest ? Math.floor((now.getTime() - earliest.getTime()) / (7 * 86_400_000)) : 0
  const level: HistoryLevel = weeks < 2 ? "too-early" : weeks < 8 ? "early" : weeks < 13 ? "emerging" : "established"
  return { weeks, since: earliest, finished: items.filter((i) => flowEnd(i, cfg) !== null).length, level }
}

export type SampleQuality = { level: "none" | "low" | "p95" | "ok"; note: string | null }

/** Whether n finished items are enough for percentiles: under 10 is rough, under 20 makes p95 shaky (decision 0023). */
export function sampleQuality(n: number): SampleQuality {
  if (n === 0) return { level: "none", note: "No finished items in this window." }
  if (n < 10) return { level: "low", note: `Only ${n} finished item${n === 1 ? "" : "s"}: percentiles are rough.` }
  if (n < 20) return { level: "p95", note: `Under 20 finished items: treat the 95th percentile with caution.` }
  return { level: "ok", note: null }
}

// ---------------------------------------------------------------------------
// Work mix and wait states (docs/decisions/0047)
// ---------------------------------------------------------------------------

export type InOutWeek = { week: Date; created: number; finished: number; open: number }

/**
 * Arrivals against departures for one flow type (Defect, Debt, …): items
 * created and first finished each week in the range, and how many were open
 * (created, not done) at each week's end. Created outpacing finished week after
 * week shows as a rising open count.
 */
export function flowInOut(items: Issue[], type: FlowType, range: DateRange, opts: FlowOptions) {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  const own = items.filter((i) => flowTypeOf(i, cfg) === type)
  const clip = (t: Date) => (t < opts.now ? t : opts.now)
  const openAt = (t: Date) =>
    own.filter((i) => {
      const status = statusAt(i, t)
      return status !== null && flowStateOf(status, i, cfg) !== "done"
    }).length
  const perWeek = weeksOf(range).map((week): InOutWeek => {
    const inWeek = (d: Date | null) => d !== null && inRange(d, range) && weekOf(d).getTime() === week.getTime()
    return {
      week,
      created: own.filter((i) => inWeek(i.created)).length,
      finished: own.filter((i) => inWeek(firstDone(i, cfg))).length,
      open: openAt(clip(endOfWeek(week, { weekStartsOn: 1 }))),
    }
  })
  return {
    perWeek,
    created: perWeek.reduce((n, w) => n + w.created, 0),
    finished: perWeek.reduce((n, w) => n + w.finished, 0),
    openAtStart: openAt(range.start),
    openAtEnd: openAt(clip(range.end)),
  }
}

export type WaitingItem = { key: string; summary: string; status: string; type: FlowType; since: Date; waitingDays: number }
export type WaitQueue = { status: string; items: WaitingItem[]; totalDays: number }

/**
 * The items in a waiting status now, one queue per status in workflow order,
 * each item with the time it has sat in that status, longest first.
 */
export function waitingNow(items: Issue[], opts: FlowOptions): WaitQueue[] {
  const cfg = opts.cfg ?? DEFAULT_FLOW_CONFIG
  const queues = new Map<string, WaitingItem[]>()
  for (const i of items) {
    if (flowStateOf(i.status, i, cfg) !== "waiting") continue
    const last = statusChanges(i).at(-1)?.at
    const since = last && last > i.created ? last : i.created
    const waitingDays = toDays(elapsedMs(since, opts.now, opts.mode, cfg.workingHours), opts.mode, cfg.workingHours)
    const item: WaitingItem = { key: i.key, summary: i.summary, status: i.status, type: flowTypeOf(i, cfg), since, waitingDays }
    queues.set(i.status, [...(queues.get(i.status) ?? []), item])
  }
  return [...queues.entries()]
    .sort(([a], [b]) => compareStatus(a, b))
    .map(([status, list]) => ({
      status,
      items: list.sort((a, b) => b.waitingDays - a.waitingDays),
      totalDays: list.reduce((n, w) => n + w.waitingDays, 0),
    }))
}
