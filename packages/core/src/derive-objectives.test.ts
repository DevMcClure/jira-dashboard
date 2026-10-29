import { describe, expect, it } from "vitest"
import piFixture from "./__fixtures__/pi-export.json"
import { trawlerExport } from "./__fixtures__/trawler-export"
import { parseExport } from "./adapter"
import { datasetAsOf } from "./asof"
import { epicsProgress, objectiveProgress } from "./metrics"

const SPRINTS = [
  { id: 1, name: "Platform 2026 PI 5 - Iteration 1", team: "TEAM-PLAT", start: "2026-08-31T08:00:00Z", end: "2026-09-11T17:00:00Z" },
  { id: 2, name: "Platform Sprint 9", team: "TEAM-PLAT", start: "2026-09-14T08:00:00Z", end: "2026-09-25T17:00:00Z" },
]

describe("Objective issues", () => {
  it("links epics by Epic Link in either direction, parent and relates-to", () => {
    const raw = trawlerExport(SPRINTS, [
      { key: "PLAT-100", type: "Objective", epicKey: "PLAT-3" },
      { key: "PLAT-1", type: "Epic", epicKey: "PLAT-100" },
      { key: "PLAT-2", type: "Epic", parentKey: "PLAT-100" },
      { key: "PLAT-3", type: "Epic" },
      { key: "PLAT-4", type: "Epic" },
      { key: "WEB-1", type: "Epic", team: "TEAM-WEB", relatedKeys: ["PLAT-100"] },
    ])
    expect([...parseExport(raw).objectiveEpics]).toEqual([["PLAT-100", ["PLAT-1", "PLAT-2", "PLAT-3", "WEB-1"]]])
  })

  it("lists every Objective issue, whatever its PI and even without epics", () => {
    const raw = trawlerExport(SPRINTS, [
      { key: "PLAT-100", type: "objective" },
      { key: "PLAT-1", type: "Epic", epicKey: "PLAT-100" },
      { key: "PLAT-101", type: "Objective" },
    ])
    const ds = parseExport(raw)
    expect([...ds.objectiveEpics]).toEqual([["PLAT-100", ["PLAT-1"]], ["PLAT-101", []]])
    // Neither has epics in a PI, so no PI lists them.
    expect(ds.programIncrements.flatMap((p) => p.objectives)).toEqual([])
  })

  it("counts progress over the epics' tickets in any sprint", () => {
    const raw = trawlerExport(SPRINTS, [
      { key: "PLAT-100", type: "Objective" },
      { key: "PLAT-1", type: "Epic", epicKey: "PLAT-100", status: "Done" },
      { key: "PLAT-10", sprint: 1, epicKey: "PLAT-1", status: "Done" },
      { key: "PLAT-11", sprint: 2, epicKey: "PLAT-1" },
      { key: "PLAT-12", epicKey: "PLAT-1" },
      { key: "PLAT-13", sprint: 1 },
    ])
    const ds = parseExport(raw)
    expect(epicsProgress(ds.objectiveEpics.get("PLAT-100")!, ds.issues)).toMatchObject({ done: 1, total: 3, pctDone: 33 })
    expect(epicsProgress([], ds.issues)).toMatchObject({ done: 0, total: 0, pctDone: 0 })
  })

  it("keeps the links on a past day's dataset", () => {
    const ds = parseExport(trawlerExport(SPRINTS, [{ key: "PLAT-100", type: "Objective" }]))
    expect(datasetAsOf(ds, new Date("2026-09-01T00:00:00Z")).objectiveEpics).toBe(ds.objectiveEpics)
  })

  it("keeps listed objectives as they are", () => {
    const ds = parseExport(piFixture)
    expect(ds.objectiveEpics.size).toBe(0)
    expect(ds.programIncrements.map((p) => [p.id, p.objectives.map((o) => o.title)])).toEqual([
      ["PI-A", ["PI A commitment", "PI A stretch"]],
      ["PI-B", ["Ship it", "Epic one shipped", "Stretch: mid-sprint task", "Nothing linked yet"]],
    ])
  })
})

const PI5 = [
  { id: 1, name: "Platform 2026 PI 5 - Iteration 1", team: "TEAM-PLAT", start: "2026-08-31T08:00:00Z", end: "2026-09-11T17:00:00Z" },
  { id: 2, name: "Web 2026 PI 5 - Iteration 1", team: "TEAM-WEB", start: "2026-08-31T08:00:00Z", end: "2026-09-11T17:00:00Z" },
  { id: 3, name: "Platform 2026 PI 6 - Iteration 1", team: "TEAM-PLAT", start: "2026-10-26T08:00:00Z", end: "2026-11-06T17:00:00Z", state: "active" },
]

const objectives = (raw: unknown) =>
  parseExport(raw).programIncrements.map((p) => [p.id, p.objectives.map((o) => [o.id, o.teamId, o.epicKeys])])

describe("PI objectives from Objective issues", () => {
  it("links epics by Epic Link in either direction, parent and relates-to, and takes the epics' PI", () => {
    const raw = trawlerExport(PI5, [
      { key: "PLAT-100", type: "Objective", epicKey: "PLAT-3" },
      { key: "PLAT-1", type: "Epic", epicKey: "PLAT-100", labels: ["PI5_2026"] },
      { key: "PLAT-2", type: "Epic", parentKey: "PLAT-100" },
      { key: "PLAT-3", type: "Epic" },
      { key: "WEB-1", type: "Epic", team: "TEAM-WEB", relatedKeys: ["PLAT-100"] },
      { key: "PLAT-10", sprint: 1, epicKey: "PLAT-2", status: "Done" },
      { key: "PLAT-11", sprint: 1, epicKey: "PLAT-3" },
    ])
    expect(objectives(raw)).toEqual([
      ["PI5_2026", [["PLAT-100", "TEAM-PLAT", ["PLAT-1", "PLAT-2", "PLAT-3", "WEB-1"]]]],
      ["PI6_2026", []],
    ])
    const ds = parseExport(raw)
    const o = ds.objectiveById.get("PLAT-100")!
    expect(o).toMatchObject({ committed: true, plannedBusinessValue: null, actualBusinessValue: null })
    expect(objectiveProgress(o, ds.programIncrements[0], ds.issues)).toMatchObject({ done: 1, total: 2 })
  })

  it("takes an unlabelled epic's PI from its stories' sprints", () => {
    const raw = trawlerExport(PI5, [
      { key: "PLAT-100", type: "Objective", team: "TEAM-ART" },
      { key: "PLAT-1", type: "Epic", epicKey: "PLAT-100" },
      { key: "PLAT-10", sprint: 3, epicKey: "PLAT-1" },
    ])
    // A team that isn't in the export makes it ART level.
    expect(objectives(raw)).toEqual([["PI5_2026", []], ["PI6_2026", [["PLAT-100", null, ["PLAT-1"]]]]])
  })

  it("skips an objective whose epics have no PI", () => {
    const raw = trawlerExport(PI5, [
      { key: "PLAT-100", type: "Objective" },
      { key: "PLAT-1", type: "Epic", epicKey: "PLAT-100" },
    ])
    expect(parseExport(raw).objectiveById.size).toBe(0)
  })
})
