import { describe, expect, it } from "vitest"
import piFixture from "./__fixtures__/pi-export.json"
import smallFixture from "./__fixtures__/small-export.json"
import { parseExport } from "./adapter"
import { trawlerExport } from "./__fixtures__/trawler-export"
import { piFromLabel, piFromSprintName } from "./derive-pis"
import { currentPi } from "./scope"

const pis = (raw: unknown) => parseExport(raw).programIncrements.map((p) => [p.id, p.name, p.startDate.toISOString().slice(0, 10), p.endDate.toISOString().slice(0, 10), p.sprintIds])

describe("PI marks", () => {
  it("reads the year and PI from sprint names", () => {
    expect(piFromSprintName("Platform 2026 PI 5 - Iteration 2")).toBe("PI5_2026")
    expect(piFromSprintName("Web 2026 pi5 - Iteration 1")).toBe("PI5_2026")
    expect(piFromSprintName("PLAT Sprint 12")).toBeNull()
  })

  it("reads epic labels like PI5_2026", () => {
    expect(piFromLabel("PI5_2026")).toBe("PI5_2026")
    expect(piFromLabel("pi05_2026")).toBe("PI5_2026")
    expect(piFromLabel("tech-debt")).toBeNull()
  })
})

describe("derived PIs", () => {
  it("builds one PI per sprint-name mark, across teams, spanning its sprints", () => {
    const raw = trawlerExport([
      { id: 1, name: "Platform 2026 PI 5 - Iteration 1", team: "TEAM-PLAT", start: "2026-08-31T08:00:00Z", end: "2026-09-11T17:00:00Z" },
      { id: 2, name: "Platform 2026 PI 5 - Iteration 2", team: "TEAM-PLAT", start: "2026-09-14T08:00:00Z", end: "2026-09-25T17:00:00Z" },
      { id: 3, name: "Web 2026 PI 5 - Iteration 1", team: "TEAM-WEB", start: "2026-08-31T08:00:00Z", end: "2026-09-11T17:00:00Z" },
      { id: 4, name: "Web 2026 PI 6 - Iteration 1", team: "TEAM-WEB", start: "2026-10-26T08:00:00Z", end: "2026-11-06T17:00:00Z", state: "active" },
    ])
    expect(pis(raw)).toEqual([
      ["PI5_2026", "2026 PI 5", "2026-08-31", "2026-09-25", [1, 3, 2]],
      ["PI6_2026", "2026 PI 6", "2026-10-26", "2026-11-06", [4]],
    ])
    const ds = parseExport(raw)
    expect(ds.programIncrements.map((p) => p.state)).toEqual(["closed", "active"])
    expect(ds.sprints.map((s) => s.piId)).toEqual(["PI5_2026", "PI5_2026", "PI5_2026", "PI6_2026"])
    expect(currentPi(ds)?.id).toBe("PI6_2026")
  })

  it("puts a sprint without a mark in the PI its issues' epics are labelled with", () => {
    const raw = trawlerExport(
      [
        { id: 1, name: "Platform 2026 PI 5 - Iteration 1", team: "TEAM-PLAT", start: "2026-08-31T08:00:00Z", end: "2026-09-11T17:00:00Z" },
        { id: 2, name: "Platform Sprint 9", team: "TEAM-PLAT", start: "2026-09-14T08:00:00Z", end: "2026-09-25T17:00:00Z" },
      ],
      [
        { key: "PLAT-1", type: "Epic", labels: ["PI5_2026"] },
        { key: "PLAT-2", sprint: 2, epicKey: "PLAT-1" },
        { key: "PLAT-3", sprint: 2 },
      ],
    )
    expect(pis(raw)).toEqual([["PI5_2026", "2026 PI 5", "2026-08-31", "2026-09-25", [1, 2]]])
  })

  it("drops a PI none of whose sprints have dates", () => {
    const raw = trawlerExport([{ id: 1, name: "Platform 2026 PI 5 - Iteration 1", team: "TEAM-PLAT" }])
    expect(parseExport(raw).programIncrements).toEqual([])
    expect(parseExport(raw).sprints[0].piId).toBeNull()
  })

  it("leaves exports without marks as plain sprint dashboards", () => {
    expect(parseExport(smallFixture).programIncrements).toEqual([])
  })

  it("never overrides an explicit programIncrements list", () => {
    expect(parseExport(piFixture).programIncrements.map((p) => p.id)).toEqual(["PI-A", "PI-B"])
  })
})
