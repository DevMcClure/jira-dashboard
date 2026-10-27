import { describe, expect, it } from "vitest"
import piFixture from "./__fixtures__/pi-export.json"
import { parseExport } from "./adapter"
import { assigneeAt, datasetAsOf, priorityAt } from "./asof"
import { burndown } from "./metrics"

const dataset = parseExport(piFixture)
const at = (iso: string) => datasetAsOf(dataset, new Date(iso))

describe("datasetAsOf", () => {
  it("is the dataset itself at (or after) its own now", () => {
    expect(datasetAsOf(dataset, dataset.meta.generatedAt)).toBe(dataset)
    expect(datasetAsOf(dataset, new Date("2030-01-01T00:00:00Z"))).toBe(dataset)
  })

  it("makes the moment the new now, and drops issues created later", () => {
    const past = at("2026-10-02T12:00:00Z")
    expect(past.meta.generatedAt.toISOString()).toBe("2026-10-02T12:00:00.000Z")
    expect(past.issues.map((i) => i.key)).toEqual(["TST-E1", "TST-1", "TST-2", "TST-3"])
    expect(past.byKey.has("TST-4")).toBe(false)
  })

  it("replays status, category and resolution", () => {
    const sep30 = at("2026-09-30T12:00:00Z")
    expect(sep30.byKey.get("TST-2")).toMatchObject({ status: "In Progress", statusCategory: "in_progress", resolved: null })
    expect(sep30.byKey.get("TST-3")).toMatchObject({ status: "To Do", statusCategory: "todo" })
    const oct1 = at("2026-10-01T12:00:00Z")
    expect(oct1.byKey.get("TST-2")).toMatchObject({ status: "Done", statusCategory: "done", resolved: new Date("2026-10-01T10:00:00Z") })
    expect(oct1.byKey.get("TST-2")!.changelog).toHaveLength(2)
    expect(sep30.byKey.get("TST-2")!.changelog).toHaveLength(1)
    expect(sep30.transitions.every((t) => t.at <= new Date("2026-09-30T12:00:00Z"))).toBe(true)
  })

  it("recomputes sprint and PI states, and hides what wasn't known yet", () => {
    const past = at("2026-09-30T12:00:00Z")
    expect([10, 11, 12, 13].map((id) => past.sprintById.get(id)!.state)).toEqual(["closed", "active", "future", "future"])
    expect(past.sprintById.get(11)!.completeDate).toBeNull()
    expect(past.sprintById.get(14)!.state).toBe("future") // no dates: unchanged
    expect(past.piById.get("PI-A")!.state).toBe("closed")
    expect(past.piById.get("PI-B")!.state).toBe("active")
    // Sprint membership stays as it is now (TST-3 was carried from 11 into 12).
    expect(past.byKey.get("TST-3")!.sprintIds).toEqual([11, 12])
  })

  it("replays a burndown day to the same value as the live burndown", () => {
    const sprint = dataset.sprintById.get(12)!
    const live = burndown(sprint, dataset.issues, dataset.meta.generatedAt)
    const oct6 = new Date("2026-10-06T23:59:59.999Z")
    const replayed = burndown(sprint, datasetAsOf(dataset, oct6).issues, oct6)
    expect(replayed.find((p) => p.date.getUTCDate() === 6)!.remaining).toBe(live.find((p) => p.date.getUTCDate() === 6)!.remaining)
  })
})

describe("assigneeAt / priorityAt", () => {
  const issue = {
    ...dataset.byKey.get("TST-3")!,
    assigneeId: "u-2",
    priority: "High",
    changelog: [
      { at: new Date("2026-10-01T00:00:00Z"), authorId: null, field: "assignee", from: null, to: "u-1" },
      { at: new Date("2026-10-03T00:00:00Z"), authorId: null, field: "assignee", from: "u-1", to: "u-2" },
      { at: new Date("2026-10-02T00:00:00Z"), authorId: null, field: "priority", from: "Low", to: "High" },
    ],
  }
  it("follows the changelog, starting from the first change's old value", () => {
    expect(assigneeAt(issue, new Date("2026-09-30T00:00:00Z"))).toBeNull()
    expect(assigneeAt(issue, new Date("2026-10-02T00:00:00Z"))).toBe("u-1")
    expect(assigneeAt(issue, new Date("2026-10-05T00:00:00Z"))).toBe("u-2")
    expect(priorityAt(issue, new Date("2026-10-01T00:00:00Z"))).toBe("Low")
    expect(priorityAt({ ...issue, changelog: [] }, new Date("2026-10-01T00:00:00Z"))).toBe("High")
  })
})
