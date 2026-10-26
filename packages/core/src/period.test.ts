import { describe, expect, it } from "vitest"
import fixture from "./__fixtures__/small-export.json"
import { parseExport } from "./adapter"
import { bucketFor, customRange, periodLabel, periodPhrase, periodRange } from "./period"

const ds = parseExport(fixture)
const now = ds.meta.generatedAt // 2026-10-08T12:00Z (TZ pinned to UTC)
const d = (s: string) => new Date(s)

describe("periodRange", () => {
  it("today starts at midnight and ends now", () => {
    expect(periodRange("today", now, ds.sprints, ds.issues)).toEqual({ start: d("2026-10-08T00:00:00Z"), end: now })
  })

  it("yesterday is the whole previous day", () => {
    expect(periodRange("yesterday", now, ds.sprints, ds.issues)).toEqual({
      start: d("2026-10-07T00:00:00Z"),
      end: d("2026-10-07T23:59:59.999Z"),
    })
  })

  it("rolling windows include today", () => {
    expect(periodRange("7d", now, ds.sprints, ds.issues).start).toEqual(d("2026-10-02T00:00:00Z"))
    expect(periodRange("14d", now, ds.sprints, ds.issues).start).toEqual(d("2026-09-25T00:00:00Z"))
  })

  it("current sprint starts at the active sprint's start day", () => {
    expect(periodRange("sprint", now, ds.sprints, ds.issues).start).toEqual(d("2026-10-05T00:00:00Z"))
  })

  it("current sprint falls back to 14 days with no active sprint", () => {
    const closed = ds.sprints.map((s) => ({ ...s, state: "closed" as const }))
    expect(periodRange("sprint", now, closed, ds.issues).start).toEqual(d("2026-09-25T00:00:00Z"))
  })

  it("all time starts at the first sprint, or the oldest ticket without sprints", () => {
    expect(periodRange("all", now, ds.sprints, ds.issues).start).toEqual(d("2026-10-05T00:00:00Z"))
    expect(periodRange("all", now, [], ds.issues).start).toEqual(d("2026-09-30T00:00:00Z"))
  })
})

describe("bucketFor", () => {
  it("uses hours for a single day and days otherwise", () => {
    expect(bucketFor(periodRange("today", now, ds.sprints, ds.issues))).toBe("hour")
    expect(bucketFor(periodRange("yesterday", now, ds.sprints, ds.issues))).toBe("hour")
    expect(bucketFor(periodRange("7d", now, ds.sprints, ds.issues))).toBe("day")
  })
})

describe("custom range", () => {
  const picked = { from: d("2026-10-05T15:00:00Z"), to: d("2026-10-07T09:00:00Z") }

  it("covers whole days, inclusive, whatever time the days were picked at", () => {
    expect(customRange(picked, now)).toEqual({ start: d("2026-10-05T00:00:00Z"), end: d("2026-10-07T23:59:59.999Z") })
  })

  it("accepts the days in either order", () => {
    expect(customRange({ from: picked.to, to: picked.from }, now)).toEqual(customRange(picked, now))
  })

  it("stops at the export's now", () => {
    expect(customRange({ from: d("2026-10-06T00:00:00Z"), to: d("2026-10-08T00:00:00Z") }, now).end).toEqual(now)
  })

  it("is what periodRange returns for 'custom', falling back to a week without dates", () => {
    expect(periodRange("custom", now, ds.sprints, ds.issues, null, picked)).toEqual(customRange(picked, now))
    expect(periodRange("custom", now, ds.sprints, ds.issues)).toEqual(periodRange("7d", now, ds.sprints, ds.issues))
  })

  it("charts a single day by hour", () => {
    const day = { from: d("2026-10-06T10:00:00Z"), to: d("2026-10-06T10:00:00Z") }
    expect(bucketFor(customRange(day, now))).toBe("hour")
  })

  it("labels and phrases itself with its dates", () => {
    const r = customRange(picked, now)
    expect(periodLabel("custom", r)).toBe("5 Oct – 7 Oct")
    expect(periodPhrase("custom", r)).toBe("between 5 Oct and 7 Oct")
    expect(periodLabel("custom", { start: d("2025-12-30T00:00:00Z"), end: d("2026-01-02T23:59:59Z") })).toBe("30 Dec 2025 – 2 Jan 2026")
    expect([periodLabel("7d", r), periodPhrase("7d", r)]).toEqual(["Last 7 days", "in the last 7 days"])
  })
})
