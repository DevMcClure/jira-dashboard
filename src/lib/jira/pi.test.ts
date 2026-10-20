import { describe, expect, it } from "vitest"
import piFixture from "./__fixtures__/pi-export.json"
import smallFixture from "./__fixtures__/small-export.json"
import { parseExport } from "./adapter"
import { epicProgress, healthLevel, piBurnup, piHealth, sprintVelocity } from "./metrics"
import { periodRange } from "./period"

const ds = parseExport(piFixture)
const now = ds.meta.generatedAt // 2026-10-08T12:00Z
const piA = ds.piById.get("PI-A")!
const piB = ds.piById.get("PI-B")!
const d = (s: string) => new Date(s)

describe("parseExport: program increments", () => {
  it("sorts PIs by start and derives missing states from dates", () => {
    expect(ds.programIncrements.map((p) => [p.id, p.state])).toEqual([
      ["PI-A", "closed"],
      ["PI-B", "active"],
    ])
    expect(piB.objectives).toEqual(["Ship it"])
    expect(piA.objectives).toEqual([])
  })

  it("assigns sprints by piId, inferring it from dates when missing", () => {
    expect(piA.sprintIds).toEqual([10])
    expect(piB.sprintIds).toEqual([11, 12, 13])
    expect(ds.sprintById.get(11)!.piId).toBe("PI-B")
  })

  it("drops an unknown piId", () => {
    expect(ds.sprintById.get(14)!.piId).toBeNull()
  })

  it("has no PIs for an export without them", () => {
    const small = parseExport(smallFixture)
    expect(small.programIncrements).toEqual([])
    expect(small.sprints[0].piId).toBeNull()
  })
})

describe("piHealth", () => {
  it("compares points done with time elapsed across the PI", () => {
    // PI B: 3 of 13 points done (23%), 10.5 of ~26 days gone (40%) → at risk.
    expect(piHealth(piB, ds.issues, now)).toEqual({
      pctDone: 23,
      pctElapsed: 40,
      daysLeft: 16,
      level: "at_risk",
      donePoints: 3,
      totalPoints: 13,
      ticketCount: 4,
    })
  })

  it("marks a closed PI completed", () => {
    expect(piHealth(piA, ds.issues, now)).toMatchObject({ level: "completed", pctDone: 100, pctElapsed: 100, daysLeft: 0 })
  })
})

describe("healthLevel", () => {
  it("uses the 15/30 point thresholds", () => {
    expect(healthLevel(50, 65, false)).toBe("on_track")
    expect(healthLevel(49, 65, false)).toBe("at_risk")
    expect(healthLevel(34, 65, false)).toBe("off_track")
    expect(healthLevel(0, 100, true)).toBe("completed")
  })
})

describe("piBurnup", () => {
  const points = piBurnup(piB, ds.issues, now)
  const on = (day: string) => points.find((p) => p.date.getTime() === d(`${day}T00:00:00Z`).getTime())!

  it("has a point per PI day", () => {
    expect(points).toHaveLength(26)
  })

  it("replays scope and done over time", () => {
    expect(on("2026-09-28")).toMatchObject({ scope: 5, done: 0 })
    expect(on("2026-10-01")).toMatchObject({ scope: 5, done: 3 })
    // TST-4 (8 pts) joined on 7 Oct; TST-5 is unestimated.
    expect(on("2026-10-08")).toMatchObject({ scope: 13, done: 3 })
  })

  it("leaves done empty after now but keeps the known scope", () => {
    expect(on("2026-10-09")).toEqual({ date: d("2026-10-09T00:00:00Z"), scope: 13, done: null })
  })
})

describe("epicProgress", () => {
  it("groups by epic, least done first, skipping tickets without one", () => {
    const inPiB = ds.issues.filter((i) => i.sprintIds.some((id) => piB.sprintIds.includes(id)))
    expect(epicProgress(inPiB)).toEqual([
      { epicKey: "TST-E2", teamIds: ["TEAM-TST"], total: 1, done: 0, points: 0, donePoints: 0, pctDone: 0 },
      { epicKey: "TST-E1", teamIds: ["TEAM-TST"], total: 2, done: 1, points: 5, donePoints: 3, pctDone: 60 },
    ])
  })
})

describe("sprintVelocity", () => {
  it("counts points committed at the start and done by the end", () => {
    // Both TST-2 and TST-3 were created after sprint 1 started, so nothing was committed.
    expect(sprintVelocity(ds.sprintById.get(11)!, ds.issues)).toEqual({
      sprintId: 11,
      sprintName: "TST Sprint 1",
      committed: 0,
      completed: 3,
    })
  })
})

describe("periodRange: this PI", () => {
  it("runs from the PI's start to now, or to its end once over", () => {
    expect(periodRange("pi", now, ds.sprints, ds.issues, piB)).toEqual({ start: d("2026-09-28T00:00:00Z"), end: now })
    expect(periodRange("pi", now, ds.sprints, ds.issues, piA).end).toEqual(piA.endDate)
  })

  it("falls back to all time without a PI", () => {
    expect(periodRange("pi", now, ds.sprints, ds.issues, null)).toEqual(periodRange("all", now, ds.sprints, ds.issues))
  })
})
