import fixture from "@jira-dashboard/core/__fixtures__/pi-export.json"
import { parseExport } from "@jira-dashboard/core/adapter"
import { SPRINT_SCOPE } from "@jira-dashboard/core/scope"
import { describe, expect, it } from "vitest"
import { keepFilters, keepPeriod, keepScope, keepSprintId } from "./reconcile-view"

const dataset = parseExport(fixture)
const noPis = parseExport({ ...fixture, programIncrements: [], sprints: fixture.sprints.map((s) => ({ ...s, piId: undefined })) })
const sprint = dataset.sprints[0].id
const team = dataset.teams[0].id
const person = dataset.people[0].id
const pi = dataset.programIncrements[0].id

describe("reconcile view with new data", () => {
  it("keeps filters the new data still has, and drops the rest", () => {
    expect(keepFilters({ sprintIds: [sprint, 99_999], teamIds: [team, "GONE"], assigneeIds: [person, null, "nobody"] }, dataset)).toEqual({
      sprintIds: [sprint],
      teamIds: [team],
      assigneeIds: [person, null],
    })
  })

  it("keeps a PI scope and the PI period only while there are PIs", () => {
    expect(keepScope({ kind: "pi", piId: pi }, dataset)).toEqual({ kind: "pi", piId: pi })
    expect(keepScope({ kind: "pi", piId: "PI-GONE" }, dataset)).toEqual(SPRINT_SCOPE)
    expect(keepPeriod("pi", dataset)).toBe("pi")
    expect(keepPeriod("pi", noPis)).toBe("today")
    expect(keepPeriod("custom", noPis)).toBe("custom")
  })

  it("forgets a burndown sprint that's gone", () => {
    expect(keepSprintId(sprint, dataset)).toBe(sprint)
    expect(keepSprintId(99_999, dataset)).toBeNull()
    expect(keepSprintId(null, dataset)).toBeNull()
  })
})
