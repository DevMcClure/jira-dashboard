/**
 * Every number here is worked by hand from __fixtures__/flow-export.json.
 * Working hours are Mon–Fri 09:00–18:00 London, i.e. 08:00–17:00Z (all dates are
 * in British Summer Time). A working day is 9 h.
 */
import { describe, expect, it } from "vitest"
import flowFixture from "./__fixtures__/flow-export.json"
import piFixture from "./__fixtures__/pi-export.json"
import { parseExport } from "./adapter"
import {
  activeWaiting,
  firstDone,
  flowDistribution,
  flowEfficiency,
  flowEnd,
  flowInOut,
  flowItems,
  flowLoad,
  flowPredictability,
  flowStart,
  flowTime,
  flowTimeByWeek,
  flowTimeDays,
  flowTimePercentiles,
  flowVelocity,
  historyCoverage,
  percentile,
  sampleQuality,
  sizeMix,
  statusSegments,
  teamFlow,
  waitingNow,
  weeklyLoad,
} from "./flow"
import { flowStateOf, flowTypeOf } from "./flowConfig"

const ds = parseExport(flowFixture)
const now = ds.meta.generatedAt // Thu 22 Oct 2026, 16:00Z
const items = flowItems(ds.issues)
const issue = (k: string) => ds.byKey.get(k)!
const d = (s: string) => new Date(s)
const H = 1 / 9 // one working hour in working days
const range = { start: d("2026-10-12T00:00:00Z"), end: now }
const working = { mode: "working" as const, now }
const calendar = { mode: "calendar" as const, now }
const round = (n: number | null) => (n === null ? null : Math.round(n * 1000) / 1000)

describe("config mapping", () => {
  it("maps statuses to flow states, unknown ones by category", () => {
    const i = issue("F-1")
    expect(["To Do", "In Progress", "QA", "In Review", "Blocked", "Done"].map((s) => flowStateOf(s, i))).toEqual([
      "not-started", "active", "active", "waiting", "waiting", "done",
    ])
    expect(flowStateOf("Deploying", i)).toBe("active")
    expect(flowStateOf("Closed", i)).toBe("done")
  })

  it("maps types: Story/Epic → Feature, Bug → Defect, labelled Task/Spike → Debt/Risk, else Other", () => {
    expect(["F-1", "F-2", "F-3", "F-5", "F-6"].map((k) => flowTypeOf(issue(k)))).toEqual([
      "Feature", "Defect", "Debt", "Feature", "Risk",
    ])
    expect(flowTypeOf({ type: "Task", labels: [] })).toBe("Other")
  })

  it("excludes Epics from flow items", () => {
    expect(items.map((i) => i.key)).toEqual(["F-1", "F-2", "F-3", "F-4", "F-6", "F-7"])
  })
})

describe("per-item history", () => {
  it("splits time into status segments up to now", () => {
    expect(statusSegments(issue("F-4"), now).map((s) => [s.status, s.state, s.from.toISOString(), s.to.toISOString()])).toEqual([
      ["To Do", "not-started", "2026-10-19T08:00:00.000Z", "2026-10-20T08:00:00.000Z"],
      ["In Progress", "active", "2026-10-20T08:00:00.000Z", "2026-10-21T13:00:00.000Z"],
      ["In Review", "waiting", "2026-10-21T13:00:00.000Z", "2026-10-22T16:00:00.000Z"],
    ])
  })

  it("a reopened item keeps its first start and its last done", () => {
    const f2 = issue("F-2")
    expect(flowStart(f2)).toEqual(d("2026-10-15T08:00:00Z"))
    expect(firstDone(f2)).toEqual(d("2026-10-15T12:00:00Z"))
    expect(flowEnd(f2)).toEqual(d("2026-10-16T11:00:00Z"))
    expect(flowEnd(issue("F-4"))).toBeNull()
    expect(flowStart(issue("F-6"))).toBeNull()
  })

  it("counts the time in Done between finishes as waiting", () => {
    // Active Thu 08–12 (4 h) + Fri 09–11 (2 h); Done Thu 12–17 + Fri 08–09 (6 h).
    const t = activeWaiting(issue("F-2"), working)
    expect([t.active / 3_600_000, t.waiting / 3_600_000]).toEqual([6, 6])
  })
})

describe("percentile (nearest rank)", () => {
  it("is the smallest value with at least p% at or below it", () => {
    expect(percentile([5, 1, 3], 50)).toBe(3)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 85)).toBe(9)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10)
    expect(percentile([], 50)).toBeNull()
  })
})

describe("flowVelocity", () => {
  it("counts items first done in the period, per week, with the previous period", () => {
    // In range: F-1 (14 Oct), F-2 (first done 15 Oct), F-3 (19 Oct). Previous 10⅔ days: F-7 (6 Oct).
    const v = flowVelocity(items, range)
    expect([v.total, v.previous, v.delta]).toEqual([3, 1, 2])
    expect(v.perWeek.map((w) => [w.week.toISOString().slice(0, 10), w.count])).toEqual([
      ["2026-10-12", 2],
      ["2026-10-19", 1],
    ])
  })
})

describe("flowTime", () => {
  it("cycle and lead time in working days, with nearest-rank percentiles", () => {
    // Cycle: F-1 20 h (9+4+4+3), F-2 12 h, F-3 3 h (Fri 15–17 + Mon 08–09).
    // Lead:  F-1 21 h, F-2 12 h, F-3 10 h (Fri 08–17 + Mon 08–09).
    const t = flowTime(items, range, working)
    expect(t.points.map((p) => [p.key, round(p.cycleDays), round(p.leadDays)])).toEqual([
      ["F-1", round(20 * H), round(21 * H)],
      ["F-2", round(12 * H), round(12 * H)],
      ["F-3", round(3 * H), round(10 * H)],
    ])
    expect([t.cycle.p50, t.cycle.p85, t.cycle.p95].map(round)).toEqual([round(12 * H), round(20 * H), round(20 * H)])
    expect([t.lead.p50, t.lead.p85].map(round)).toEqual([round(12 * H), round(21 * H)])
  })

  it("calendar time counts nights and the weekend", () => {
    // Cycle: F-1 50 h, F-2 27 h, F-3 66 h (Fri 15:00 → Mon 09:00).
    const t = flowTime(items, range, calendar)
    expect(t.points.map((p) => round(p.cycleDays))).toEqual([round(50 / 24), round(27 / 24), round(66 / 24)])
    expect(round(t.cycle.p50)).toBe(round(50 / 24))
  })
})

describe("flowLoad", () => {
  it("daily WIP is items in active or waiting states at the end of each day", () => {
    const l = flowLoad(items, range, working)
    // 12: F-1 in progress · 13: F-1 blocked · 14: F-1 done · 15: F-2 done by noon · 16–18: F-3 in review
    // 19: F-3 done, F-4 not started · 20: F-4 in progress · 21–22: F-4 in review
    expect(l.daily.map((r) => r.wip)).toEqual([1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1])
    expect(l.daily[1]).toMatchObject({ active: 0, waiting: 1 })
  })

  it("ages each open item from its flow start", () => {
    // F-4 started Tue 20 Oct 08:00Z: Tue 9 h + Wed 9 h + Thu 08–16 8 h = 26 h; calendar 56 h.
    const l = flowLoad(items, range, working)
    expect(l.aging.map((a) => [a.key, a.status, a.state, round(a.ageDays)])).toEqual([["F-4", "In Review", "waiting", round(26 * H)]])
    expect([l.wipNow, round(l.avgAgeDays)]).toEqual([1, round(26 * H)])
    expect(round(flowLoad(items, range, calendar).aging[0].ageDays)).toBe(round(56 / 24))
  })
})

describe("flowEfficiency", () => {
  it("is Σ active ÷ Σ (active + waiting) over finished items, not an average of ratios", () => {
    // Working: active 12 + 6 + 1 = 19 h; waiting 8 + 6 + 2 = 16 h → 19/35 = 54%.
    const e = flowEfficiency(items, range, working)
    expect(e.pct).toBe(54)
    expect([round(e.activeDays), round(e.waitingDays)]).toEqual([round(19 * H), round(16 * H)])
    // Per finish week: 12 Oct (F-1, F-2) 18/32 = 56%; 19 Oct (F-3) 1/3 = 33%.
    expect(e.perWeek.map((w) => [w.pct, w.items])).toEqual([[56, 2], [33, 1]])
  })

  it("is much lower in calendar time, because nights and weekends count as waiting", () => {
    // Active 27 + 6 + 1 = 34 h; waiting 23 + 21 + 65 = 109 h → 34/143 = 24%.
    expect(flowEfficiency(items, range, calendar).pct).toBe(24)
  })

  it("shows where the time goes, by status in workflow order", () => {
    const e = flowEfficiency(items, range, working)
    expect(e.byStatus.map((s) => [s.status, s.state, round(s.days)])).toEqual([
      ["In Progress", "active", round(19 * H)],
      ["In Review", "waiting", round(6 * H)],
      ["Blocked", "waiting", round(4 * H)],
      ["Done", "done", round(6 * H)],
    ])
  })
})

describe("flowDistribution", () => {
  it("counts finished items by flow type per sprint, in the period and in WIP", () => {
    const dist = flowDistribution(items, ds.sprints, range, working)
    expect(dist.perSprint.map((s) => [s.name, s.counts, s.total])).toEqual([
      ["F 1", { Feature: 1, Defect: 0, Risk: 0, Debt: 0, Other: 0 }, 1],
      ["F 2", { Feature: 1, Defect: 1, Risk: 0, Debt: 1, Other: 0 }, 3],
    ])
    expect(dist.finished).toEqual({ Feature: 1, Defect: 1, Risk: 0, Debt: 1, Other: 0 })
    expect(dist.wip).toEqual({ Feature: 1, Defect: 0, Risk: 0, Debt: 0, Other: 0 })
  })
})

describe("flowPredictability", () => {
  it("is F1's predictability per PI, null until assessed", () => {
    const pis = parseExport(piFixture).programIncrements
    expect(flowPredictability(pis)).toEqual([
      { piId: "PI-A", name: "PI A", state: "closed", pct: 125 },
      { piId: "PI-B", name: "PI B", state: "active", pct: null },
    ])
  })
})

describe("flow time basis", () => {
  it("'created' uses lead time and 'started' uses cycle time", () => {
    const t = flowTime(items, range, working)
    const f1 = t.points.find((p) => p.key === "F-1")!
    expect([round(flowTimeDays(f1, "created")), round(flowTimeDays(f1, "started"))]).toEqual([round(21 * H), round(20 * H)])
    expect(flowTimePercentiles(t, "created")).toBe(t.lead)
    expect(flowTimePercentiles(t, "started")).toBe(t.cycle)
  })
})

describe("flowTimeByWeek", () => {
  it("gives each finish week's p50 / p85", () => {
    // Week of 12 Oct: F-1 (cycle 20 h), F-2 (12 h) → p50 12 h, p85 20 h. Week of 19 Oct: F-3 (3 h).
    const started = flowTimeByWeek(items, range, working, "started")
    expect(started.map((w) => [w.week.toISOString().slice(0, 10), w.count, round(w.p50), round(w.p85)])).toEqual([
      ["2026-10-12", 2, round(12 * H), round(20 * H)],
      ["2026-10-19", 1, round(3 * H), round(3 * H)],
    ])
    // From created: F-1 21 h, F-2 12 h; F-3 10 h.
    const created = flowTimeByWeek(items, range, working, "created")
    expect(created.map((w) => [round(w.p50), round(w.p85)])).toEqual([
      [round(12 * H), round(21 * H)],
      [round(10 * H), round(10 * H)],
    ])
  })
})

describe("weeklyLoad", () => {
  it("averages each week's end-of-day WIP beside its throughput and flow time", () => {
    // Daily WIP 12–18 Oct: 1,1,0,0,1,1,1 → 5/7; 19–22 Oct: 0,1,1,1 → 3/4. Finished: 2, then 1.
    const w = weeklyLoad(items, range, working, "started")
    expect(w.map((r) => [round(r.avgWip), r.throughput, round(r.flowTimeP85)])).toEqual([
      [round(5 / 7), 2, round(20 * H)],
      [round(3 / 4), 1, round(3 * H)],
    ])
  })
})

describe("teamFlow", () => {
  it("summarises each team, including WIP per member", () => {
    const teams = [...ds.teams, { id: "TEAM-X", name: "Empty", memberIds: [] }]
    const [f, x] = teamFlow(items, teams, range, working, "created")
    // TEAM-F (1 member): 3 finished; lead times 10 h, 12 h, 21 h → p50 12 h, p85 21 h; F-4 in progress.
    expect({ ...f, flowTime: { p50: round(f.flowTime.p50), p85: round(f.flowTime.p85), n: f.flowTime.n } }).toMatchObject({
      teamId: "TEAM-F",
      members: 1,
      velocity: 3,
      flowTime: { p50: round(12 * H), p85: round(21 * H), n: 3 },
      wip: 1,
      wipPerMember: 1,
      efficiency: 54,
      finished: { Feature: 1, Defect: 1, Risk: 0, Debt: 1, Other: 0 },
    })
    expect(x).toMatchObject({ velocity: 0, wip: 0, wipPerMember: null, efficiency: null, flowTime: { n: 0, p85: null } })
  })
})

describe("sizeMix", () => {
  it("buckets finished items by story points, with the median now and before", () => {
    // In range: F-1 3, F-2 2, F-3 5 → median 3. Previous period: F-7 8.
    const s = sizeMix(items, range)
    expect(s.buckets.filter((b) => b.count).map((b) => [b.size, b.count])).toEqual([["2", 1], ["3", 1], ["5", 1]])
    expect([s.finished, s.unestimated, s.median, s.previousMedian]).toEqual([3, 0, 3, 8])
  })
})

describe("historyCoverage", () => {
  it("counts whole weeks since the earliest flow start", () => {
    // Earliest start: F-7, Mon 5 Oct 08:00Z; now Thu 22 Oct 16:00Z → 17⅓ days → 2 weeks.
    expect(historyCoverage(items, now)).toMatchObject({ weeks: 2, finished: 4, level: "early" })
    expect(historyCoverage([], now).level).toBe("too-early")
  })
})

describe("sampleQuality", () => {
  it("warns below 10 and below 20 items", () => {
    expect([0, 3, 12, 20].map((n) => sampleQuality(n).level)).toEqual(["none", "low", "p95", "ok"])
  })
})

describe("flowInOut", () => {
  it("counts created and first finished per week, and what's open at each week's end", () => {
    // F-2 (Defect): created and done Thu 15 Oct, reopened and done again Fri 16: one in, one out.
    const defect = flowInOut(items, "Defect", range, working)
    expect(defect.perWeek.map((w) => [w.week.toISOString().slice(0, 10), w.created, w.finished, w.open])).toEqual([
      ["2026-10-12", 1, 1, 0],
      ["2026-10-19", 0, 0, 0],
    ])
    // F-3 (Debt): created Fri 16 Oct, still in review at the weekend, done Mon 19.
    const debt = flowInOut(items, "Debt", range, working)
    expect(debt.perWeek.map((w) => [w.created, w.finished, w.open])).toEqual([[1, 0, 1], [0, 1, 0]])
    expect([debt.created, debt.finished, debt.openAtStart, debt.openAtEnd]).toEqual([1, 1, 0, 0])
  })

  it("counts open items at the range's start and end", () => {
    // F-1 (Feature) is open on 13 Oct; F-4 (Feature) and F-6 (Risk) are open now.
    const r = { start: d("2026-10-13T12:00:00Z"), end: now }
    const feature = flowInOut(items, "Feature", r, working)
    expect([feature.openAtStart, feature.openAtEnd]).toEqual([1, 1])
    expect(flowInOut(items, "Risk", r, working).openAtEnd).toBe(1)
  })
})

describe("waitingNow", () => {
  it("groups waiting items by status, timed from when they entered it", () => {
    // F-4 entered In Review Wed 21 Oct 13:00Z: Wed 13–17 4 h + Thu 08–16 8 h = 12 h; calendar 27 h.
    const q = waitingNow(items, working)
    expect(q.map((w) => [w.status, w.items.map((i) => [i.key, i.type, round(i.waitingDays)]), round(w.totalDays)])).toEqual([
      ["In Review", [["F-4", "Feature", round(12 * H)]], round(12 * H)],
    ])
    expect(round(waitingNow(items, calendar)[0].items[0].waitingDays)).toBe(round(27 / 24))
  })

  it("is empty when nothing waits", () => {
    expect(waitingNow(items.filter((i) => i.key !== "F-4"), working)).toEqual([])
  })
})
