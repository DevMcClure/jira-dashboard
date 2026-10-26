/**
 * Weekly buckets must follow local calendar weeks across a clock change. The
 * other tests run in UTC (vitest.config.ts), so this file switches to London
 * time for its own run and restores UTC afterwards.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { parseExport } from "./adapter"
import { flowEfficiency, flowItems, flowVelocity } from "./flow"

// Setting TZ at runtime makes Node re-read the local time zone.
beforeAll(() => {
  vi.stubEnv("TZ", "Europe/London")
})
afterAll(() => {
  vi.unstubAllEnvs()
})

const done = (key: string, startAt: string, doneAt: string) => ({
  key,
  summary: key,
  type: "Story",
  status: "Done",
  statusCategory: "done",
  created: startAt,
  resolved: doneAt,
  changelog: [
    { at: startAt, field: "status", from: "To Do", to: "In Progress" },
    { at: doneAt, field: "status", from: "In Progress", to: "Done" },
  ],
})

describe("weekly buckets across the 25 Oct 2026 clock change (London)", () => {
  // Mon 19 Oct is BST (UTC+1); Mon 26 Oct is GMT (UTC+0).
  const ds = parseExport({
    meta: { generatedAt: "2026-10-30T17:00:00Z" },
    issues: [done("A-1", "2026-10-19T09:00:00Z", "2026-10-20T10:00:00Z"), done("A-2", "2026-10-26T09:00:00Z", "2026-10-27T10:00:00Z")],
  })
  const items = flowItems(ds.issues)
  const range = { start: new Date(2026, 9, 19), end: ds.meta.generatedAt } // local midnight Mon 19 Oct

  it("really runs in London time (BST, then GMT)", () => {
    expect([new Date(2026, 9, 19).getTimezoneOffset(), new Date(2026, 9, 26).getTimezoneOffset()]).toEqual([-60, 0])
  })

  it("velocity has one bucket per local week, each with its item", () => {
    const v = flowVelocity(items, range)
    expect(v.perWeek.map((w) => [w.week.getDate(), w.week.getHours(), w.count])).toEqual([
      [19, 0, 1],
      [26, 0, 1],
    ])
  })

  it("efficiency's weekly trend doesn't drop the second week", () => {
    const e = flowEfficiency(items, range, { mode: "calendar", now: ds.meta.generatedAt })
    expect(e.perWeek.map((w) => w.items)).toEqual([1, 1])
  })
})
