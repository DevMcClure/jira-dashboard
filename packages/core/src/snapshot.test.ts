import { describe, expect, it } from "vitest"
import piFixture from "./__fixtures__/pi-export.json"
import { parseExport } from "./adapter"
import { buildSnapshots, dayKey, parseDay, snapshotSchema } from "./snapshot"

const dataset = parseExport(piFixture)
const opts = { ingestId: "ing-1", takenAt: new Date("2026-10-09T06:00:00Z"), backfilled: false }

describe("buildSnapshots", () => {
  it("writes one valid snapshot per team", () => {
    const snaps = buildSnapshots(dataset, "2026-10-07", opts)
    expect(snaps).toHaveLength(1)
    expect(() => snapshotSchema.parse(snaps[0])).not.toThrow()
    expect(snaps[0]).toMatchObject({ schemaVersion: 1, teamId: "TEAM-TST", date: "2026-10-07", ingestId: "ing-1", backfilled: false, stale: false })
  })

  it("describes the sprint that was running that day, replayed to the end of it", () => {
    const [s] = buildSnapshots(dataset, "2026-10-07", opts)
    expect(s.asOf).toBe("2026-10-07T23:59:59.999Z")
    expect(s.sprint).toEqual({ id: 12, name: "TST Sprint 2", dayOfSprint: 3, workingDaysTotal: 10 })
    expect(s.pi).toMatchObject({ id: "PI-B", name: "PI B" })
    expect(s.totals).toEqual({ tickets: 2, points: 10, pointsDone: 0, pointsRemaining: 10, scopeAddedToday: 8 })
    expect(s.statusCounts).toEqual({ "To Do": 1, "In Progress": 1 })
    expect(s.burndown).toEqual({ ideal: expect.any(Number), remaining: 10 })
    expect(s.issues.map((i) => [i.key, i.status, i.points])).toEqual([
      ["TST-3", "In Progress", 2],
      ["TST-4", "To Do", 8],
    ])
    expect(s.activity).toEqual({ moves: 0, created: 1, resolved: 0, blockedNew: 0 })
  })

  it("goes back to earlier sprints, and to the gap between them", () => {
    expect(buildSnapshots(dataset, "2026-09-30", opts)[0]).toMatchObject({ sprint: { id: 11 }, statusCounts: { "In Progress": 1, "To Do": 1 } })
    const gap = buildSnapshots(dataset, "2026-10-03", opts)[0] // Saturday after sprint 11 closed
    expect(gap).toMatchObject({ sprint: null, burndown: null, health: null, issues: [], totals: { tickets: 0 } })
  })

  it("keeps a sprint's last day, when it closed during the day, with that day's burndown point", () => {
    const lastDay = buildSnapshots(dataset, "2026-10-02", opts)[0] // sprint 11 completed at 16:00
    expect(lastDay).toMatchObject({ sprint: { id: 11, dayOfSprint: 5, workingDaysTotal: 5 }, health: "completed", burndown: { remaining: 2 } })
  })

  it("marks the data's own day stale, and refuses days after it unless asked to record them stale", () => {
    expect(buildSnapshots(dataset, "2026-10-08", opts)[0]).toMatchObject({ stale: true, asOf: "2026-10-08T12:00:00.000Z" })
    expect(() => buildSnapshots(dataset, "2026-10-09", opts)).toThrow(/after the data's "now"/)
    const later = buildSnapshots(dataset, "2026-10-12", { ...opts, staleAfterNow: true })[0]
    expect(later).toMatchObject({ date: "2026-10-12", stale: true, asOf: "2026-10-08T12:00:00.000Z", sprint: { id: 12 }, burndown: null })
    expect(later.totals).toEqual(buildSnapshots(dataset, "2026-10-08", opts)[0].totals)
  })

  it("is deterministic apart from takenAt", () => {
    const a = buildSnapshots(dataset, "2026-10-06", opts)
    const b = buildSnapshots(dataset, "2026-10-06", { ...opts, takenAt: new Date() })
    expect({ ...a[0], takenAt: "" }).toEqual({ ...b[0], takenAt: "" })
  })
})

describe("parseDay / dayKey", () => {
  it("round-trips a calendar day and refuses anything else", () => {
    expect(dayKey(parseDay("2026-10-19"))).toBe("2026-10-19")
    expect(() => parseDay("2026-02-30")).toThrow()
    expect(() => parseDay("19/10/2026")).toThrow()
  })
})
