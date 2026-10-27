import fixture from "@jira-dashboard/core/__fixtures__/pi-export.json"
import { parseExport } from "@jira-dashboard/core/adapter"
import { buildSnapshots } from "@jira-dashboard/core/snapshot"
import { describe, expect, it } from "vitest"
import { historyDayLabel, historyRanges, historySeries } from "./history-series"

const dataset = parseExport(fixture)
const summary = (day: string, backfilled = false) => {
  const { issues: _issues, ...rest } = buildSnapshots(dataset, day, { ingestId: null, takenAt: new Date(), backfilled })[0]
  return rest
}

describe("historySeries", () => {
  it("gives one row per day, keeping days without a snapshot as gaps", () => {
    const { rows } = historySeries([summary("2026-10-06"), summary("2026-10-08", true)], "2026-10-06", "2026-10-08")
    expect(rows.map((r) => [r.date, r.label, r.missing])).toEqual([
      ["2026-10-06", "6 Oct", false],
      ["2026-10-07", "7 Oct", true],
      ["2026-10-08", "8 Oct", false],
    ])
    expect(rows[1]).toMatchObject({ remaining: null, wip: null, health: null, statusCounts: {} })
    expect(rows[0]).toMatchObject({ sprint: "TST Sprint 2", remaining: 2, health: expect.any(String), stale: false, backfilled: false })
    expect(rows[2]).toMatchObject({ stale: true, backfilled: true })
    expect(rows.map(historyDayLabel)).toEqual(["6 Oct · TST Sprint 2", "7 Oct", "8 Oct · TST Sprint 2 (backfilled, stale)"])
  })

  it("lists every status seen, in workflow order", () => {
    const { statuses } = historySeries([summary("2026-10-07"), summary("2026-09-29")], "2026-09-29", "2026-10-07")
    expect(statuses).toEqual(["To Do", "In Progress"])
  })
})

describe("historyRanges", () => {
  it("offers the last 30 days, the current PI so far and the previous PI", () => {
    expect(historyRanges(dataset)).toEqual([
      { id: "30d", label: "Last 30 days", from: "2026-09-09", to: "2026-10-08" },
      { id: "pi", label: "PI B", from: "2026-09-28", to: "2026-10-08" },
      { id: "prev-pi", label: "PI A", from: "2026-08-31", to: "2026-09-25" },
    ])
  })
})
