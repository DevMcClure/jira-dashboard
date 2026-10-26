import { describe, expect, it } from "vitest"
import piFixture from "./__fixtures__/pi-export.json"
import { parseExport } from "./adapter"
import {
  objectiveForecast,
  objectiveHealth,
  objectiveIssues,
  objectiveProgress,
  piPredictability,
} from "./metrics"
import type { Objective } from "./types"

const ds = parseExport(piFixture)
const now = ds.meta.generatedAt // Thu 8 Oct 2026, 12:00Z
const piA = ds.piById.get("PI-A")!
const piB = ds.piById.get("PI-B")!
const obj = (id: string) => ds.objectiveById.get(id)!
const keys = (xs: { key: string }[]) => xs.map((x) => x.key)
/** An objective linking just the given issues, for hand-worked cases. */
const linking = (issueKeys: string[], over: Partial<Objective> = {}): Objective => ({
  ...obj("OBJ-B1"),
  epicKeys: [],
  issueKeys,
  ...over,
})

describe("parseExport: objectives", () => {
  it("normalises full objectives, defaulting committed and the PI", () => {
    expect(obj("OBJ-B1")).toEqual({
      id: "OBJ-B1",
      piId: "PI-B",
      teamId: "TEAM-TST",
      title: "Epic one shipped",
      description: null,
      ownerId: "u-9",
      committed: true,
      plannedBusinessValue: 8,
      actualBusinessValue: null,
      epicKeys: ["TST-E1"],
      issueKeys: [],
    })
  })

  it("is lenient: unknown team → ART level, out-of-range BV → not set", () => {
    expect(obj("OBJ-B3")).toMatchObject({ teamId: null, plannedBusinessValue: null })
  })

  it("synthesises an unknown owner like any other person reference", () => {
    expect(ds.personById.get("u-9")?.displayName).toBe("Unknown (u-9)")
  })
})

describe("objectiveIssues", () => {
  it("takes the epics' stories in the PI's sprints, not the epic itself", () => {
    expect(keys(objectiveIssues(obj("OBJ-B1"), piB, ds.issues))).toEqual(["TST-2", "TST-3"])
  })

  it("includes directly linked issues, but only inside the PI's sprints", () => {
    expect(keys(objectiveIssues(obj("OBJ-B2"), piB, ds.issues))).toEqual(["TST-4"])
    // TST-1 is in PI A's sprint, so it doesn't count towards a PI B objective.
    expect(objectiveIssues(linking(["TST-1"]), piB, ds.issues)).toEqual([])
  })
})

describe("objectiveProgress", () => {
  it("is done points ÷ points in scope", () => {
    // TST-2 (3 pts, done) + TST-3 (2 pts, in progress)
    expect(objectiveProgress(obj("OBJ-B1"), piB, ds.issues)).toEqual({
      pctDone: 60,
      donePoints: 3,
      totalPoints: 5,
      done: 1,
      total: 2,
      byPoints: true,
    })
  })

  it("falls back to ticket counts when nothing is estimated", () => {
    // TST-5 has no points and isn't done.
    expect(objectiveProgress(linking(["TST-5"]), piB, ds.issues)).toMatchObject({ pctDone: 0, total: 1, byPoints: false })
  })

  it("follows the filtered issue list", () => {
    const withoutTst3 = ds.issues.filter((i) => i.key !== "TST-3")
    expect(objectiveProgress(obj("OBJ-B1"), piB, withoutTst3).pctDone).toBe(100)
  })

  it("replays the changelog at an earlier time", () => {
    // On 30 Sep TST-2 wasn't done yet.
    expect(objectiveProgress(obj("OBJ-B1"), piB, ds.issues, new Date("2026-09-30T12:00:00Z")).pctDone).toBe(0)
  })
})

describe("objectiveHealth", () => {
  it("compares progress with the PI's time gone", () => {
    // 60% done with 40% of PI B gone → on track.
    expect(objectiveHealth(obj("OBJ-B1"), piB, ds.issues, now)).toEqual({ level: "on_track", pctDone: 60, pctElapsed: 40 })
    // 0% done with 40% gone → off track.
    expect(objectiveHealth(obj("OBJ-B2"), piB, ds.issues, now).level).toBe("off_track")
  })

  it("is 'no_data' without linked tickets and 'completed' once the PI is closed", () => {
    expect(objectiveHealth(obj("OBJ-B3"), piB, ds.issues, now).level).toBe("no_data")
    expect(objectiveHealth(obj("OBJ-A1"), piA, ds.issues, now).level).toBe("completed")
  })
})

describe("objectiveForecast", () => {
  it("projects the recent daily gain over the working days left", () => {
    // TST-2 (3 pts, done) + TST-4 (8 pts, to do): 3/11 = 27.27% done now.
    // The 10-working-day window starts before the PI, so it runs from 28 Sep (0% then):
    //   8 working days → 3.409%/day; 11 working days left → 27.27 + 37.5 = 64.77 → 65.
    expect(objectiveForecast(linking(["TST-2", "TST-4"]), piB, ds.issues, now)).toBe(65)
  })

  it("caps at 100%", () => {
    expect(objectiveForecast(obj("OBJ-B1"), piB, ds.issues, now)).toBe(100)
  })

  it("is the final % for a closed PI, and null without tickets or for a future PI", () => {
    expect(objectiveForecast(obj("OBJ-A1"), piA, ds.issues, now)).toBe(100)
    expect(objectiveForecast(obj("OBJ-B3"), piB, ds.issues, now)).toBeNull()
    expect(objectiveForecast(obj("OBJ-B1"), { ...piB, state: "future" }, ds.issues, now)).toBeNull()
  })
})

describe("piPredictability", () => {
  it("is Σ actual ÷ Σ planned of committed, with uncommitted adding to actual only", () => {
    // Committed: planned 8, actual 6. Uncommitted adds 4 → 10 / 8 = 125%.
    expect(piPredictability(piA.objectives)).toEqual({ pct: 125, planned: 8, actual: 10 })
    expect(piPredictability(piA.objectives.filter((o) => o.committed))).toEqual({ pct: 75, planned: 8, actual: 6 })
  })

  it("is null until committed objectives have been assessed", () => {
    expect(piPredictability(piB.objectives)).toBeNull()
    expect(piPredictability([])).toBeNull()
  })
})
