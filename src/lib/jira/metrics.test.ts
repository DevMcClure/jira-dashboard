import { describe, expect, it } from "vitest"
import fixture from "./__fixtures__/small-export.json"
import { JiraExportError, parseExport } from "./adapter"
import {
  burndown,
  countByStatus,
  countByStatusCategory,
  createdSince,
  createdVsResolvedPerDay,
  cumulativeFlow,
  cycleTimeDays,
  pointsAt,
  remainingPoints,
  resolvedSince,
  scopeChange,
  sprintHealth,
  statusAt,
  ticketAgeDays,
  transitionsPerDay,
  velocity,
  workloadByPerson,
} from "./metrics"

const ds = parseExport(fixture)
const { issues, meta } = ds
const now = meta.generatedAt // 2026-10-08T12:00Z
const sprint = ds.sprintById.get(1)!
const [tst1, tst2, tst3] = ["TST-1", "TST-2", "TST-3"].map((k) => ds.byKey.get(k)!)
const d = (s: string) => new Date(s)
const HOUR = 3_600_000
const range = { start: d("2026-10-05T00:00:00Z"), end: d("2026-10-08T12:00:00Z") }

describe("parseExport", () => {
  it("converts dates and sorts changelogs ascending", () => {
    expect(tst1.created).toBeInstanceOf(Date)
    expect(tst1.changelog.map((c) => c.to)).toEqual(["In Progress", "QA", "Done"])
  })

  it("flattens status transitions sorted by time with time-in-previous", () => {
    expect(ds.transitions.map((t) => `${t.issueKey}:${t.to}`)).toEqual([
      "TST-1:In Progress",
      "TST-1:QA",
      "TST-3:Triage",
      "TST-2:In Progress",
      "TST-1:Done",
      "TST-2:Blocked",
    ])
    const [first, second] = ds.transitions
    expect(first.msInPrevious).toBe(96 * HOUR) // created → first move
    expect(second.msInPrevious).toBe(25 * HOUR)
  })

  it("synthesises unknown people instead of crashing", () => {
    expect(ds.personById.get("u-3")?.displayName).toBe("Unknown (u-3)")
  })

  it("lists statuses in workflow order with unknown statuses last", () => {
    expect(ds.statuses.map((s) => s.name)).toEqual([
      "To Do",
      "In Progress",
      "Blocked",
      "QA",
      "Done",
      "Triage",
    ])
    expect(ds.statuses.find((s) => s.name === "Triage")).toMatchObject({
      category: "todo",
      colorVar: "--status-todo",
    })
  })

  it("coerces numeric changelog values to strings", () => {
    expect(tst3.changelog.find((c) => c.field === "storyPoints")).toMatchObject({ from: "2", to: "8" })
  })

  it("throws a readable error listing the first 5 problems", () => {
    const bad = { issues: Array.from({ length: 7 }, () => ({ key: "X-1" })) }
    let err: unknown
    try {
      parseExport(bad)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(JiraExportError)
    const e = err as JiraExportError
    expect(e.problems.length).toBeGreaterThan(5)
    expect(e.message.split("\n").filter((l) => l.startsWith("issues.")).length).toBe(5)
    expect(e.message).toContain("issues.0.summary:")
    expect(e.message).toMatch(/and \d+ more/)
  })

  it("falls back for missing optional sections", () => {
    const min = parseExport({
      issues: [{ key: "A-1", summary: "s", status: "To Do", statusCategory: "todo", created: "2026-01-01T00:00:00Z", changelog: [] }],
    })
    expect(min.teams).toEqual([])
    expect(min.meta.generatedAt).toEqual(d("2026-01-01T00:00:00Z"))
  })
})

describe("replay helpers", () => {
  it("statusAt replays the changelog", () => {
    expect(statusAt(tst1, d("2026-09-30T00:00:00Z"))).toBeNull()
    expect(statusAt(tst1, d("2026-10-05T09:00:00Z"))).toBe("To Do")
    expect(statusAt(tst1, d("2026-10-06T12:00:00Z"))).toBe("QA")
    expect(statusAt(tst1, now)).toBe("Done")
  })

  it("pointsAt replays estimate changes", () => {
    expect(pointsAt(tst3, d("2026-10-06T00:00:00Z"))).toBe(2)
    expect(pointsAt(tst3, now)).toBe(8)
    expect(pointsAt(tst1, now)).toBe(5)
  })
})

describe("counts", () => {
  it("countByStatusCategory", () => {
    expect(countByStatusCategory(issues)).toEqual({ todo: 1, in_progress: 1, done: 1, total: 3 })
  })

  it("countByStatus orders by workflow and colours unknown statuses by category", () => {
    expect(countByStatus(issues)).toEqual([
      { status: "Blocked", count: 1, colorVar: "--status-blocked" },
      { status: "Done", count: 1, colorVar: "--status-done" },
      { status: "Triage", count: 1, colorVar: "--status-todo" },
    ])
  })

  it("remainingPoints excludes done issues", () => {
    expect(remainingPoints(issues)).toBe(11)
  })

  it("createdSince / resolvedSince", () => {
    expect(createdSince(issues, d("2026-10-05T00:00:00Z"))).toBe(1)
    expect(createdSince(issues, d("2026-09-30T00:00:00Z"))).toBe(3)
    expect(resolvedSince(issues, d("2026-10-05T00:00:00Z"))).toBe(1)
    expect(resolvedSince(issues, d("2026-10-08T00:00:00Z"))).toBe(0)
  })
})

describe("sprints", () => {
  it("burndown tracks completions and mid-sprint scope", () => {
    const b = burndown(sprint, issues, now)
    expect(b).toHaveLength(12) // 5 Oct → 16 Oct
    expect(b.slice(0, 5).map((p) => p.remaining)).toEqual([7, 10, 11, 11, null])
    expect(b[0].ideal).toBe(7)
    expect(b.at(-1)!.ideal).toBe(0)
    expect(b.at(-1)!.remaining).toBeNull()
  })

  it("burndown returns nothing for an undated sprint", () => {
    expect(burndown({ ...sprint, startDate: null }, issues, now)).toEqual([])
  })

  it("scopeChange counts new issues and estimate increases", () => {
    expect(scopeChange(sprint, issues)).toEqual({ added: 9, removed: 0, net: 9 })
  })

  it("sprintHealth compares % done with % elapsed", () => {
    expect(sprintHealth(sprint, issues, now)).toEqual({
      pctDone: 31,
      pctElapsed: 28,
      daysLeft: 9,
      level: "on_track",
    })
    expect(sprintHealth(sprint, issues, d("2026-10-11T00:00:00Z")).level).toBe("at_risk")
    expect(sprintHealth(sprint, issues, d("2026-10-12T12:00:00Z")).level).toBe("off_track")
    const closed = { ...sprint, state: "closed" as const, completeDate: now }
    expect(sprintHealth(closed, issues, now)).toMatchObject({ level: "completed", daysLeft: 0 })
  })

  it("velocity reports completed points per closed sprint", () => {
    const team = ds.teamById.get("TEAM-TST")!
    expect(velocity(team, ds.sprints, issues)).toEqual([])
    const closed = { ...sprint, state: "closed" as const, completeDate: now }
    expect(velocity(team, [closed], issues)).toEqual([
      { sprintId: 1, sprintName: "TST Sprint 1", committed: 7, completed: 5 },
    ])
  })
})

describe("people", () => {
  it("workloadByPerson includes Unassigned and sorts by open points", () => {
    const w = workloadByPerson(issues)
    expect(w.map((x) => x.personId)).toEqual([null, "u-3", "u-1"])
    expect(w[0]).toEqual({ personId: null, todo: 1, in_progress: 0, done: 0, total: 1, points: 8, openPoints: 8 })
    expect(w[2]).toMatchObject({ done: 1, points: 5, openPoints: 0 })
  })
})

describe("movement over time", () => {
  it("transitionsPerDay buckets by destination status", () => {
    const rows = transitionsPerDay(ds.transitions, range)
    expect(rows.map((r) => r.total)).toEqual([1, 2, 2, 1])
    expect(rows[1].counts).toEqual({ QA: 1, Triage: 1 })
    expect(rows[3].counts).toEqual({ Blocked: 1 })
  })

  it("createdVsResolvedPerDay", () => {
    expect(createdVsResolvedPerDay(issues, range).map(({ created, resolved }) => [created, resolved])).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 0],
    ])
  })

  it("cumulativeFlow replays end-of-day status", () => {
    const rows = cumulativeFlow(issues, range)
    expect(rows[0].counts).toEqual({ "In Progress": 1, "To Do": 1 })
    expect(rows[1].counts).toEqual({ QA: 1, "To Do": 1, Triage: 1 })
    expect(rows[3].counts).toEqual({ Done: 1, Blocked: 1, Triage: 1 })
    expect(rows.map((r) => r.total)).toEqual([2, 3, 3, 3])
  })

  it("returns no rows for an inverted range", () => {
    expect(cumulativeFlow(issues, { start: range.end, end: range.start })).toEqual([])
  })
})

describe("per issue", () => {
  it("ticketAgeDays uses resolved for done issues", () => {
    expect(ticketAgeDays(tst1, now)).toBe(6)
    expect(ticketAgeDays(tst2, now)).toBe(2)
    expect(ticketAgeDays(tst3, now)).toBe(8)
  })

  it("cycleTimeDays measures first in-progress → done", () => {
    expect(cycleTimeDays(tst1)).toBeCloseTo(53 / 24, 5)
    expect(cycleTimeDays(tst2)).toBeNull()
    expect(cycleTimeDays(tst3)).toBeNull()
  })
})
