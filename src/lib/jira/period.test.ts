import { describe, expect, it } from "vitest"
import fixture from "./__fixtures__/small-export.json"
import { parseExport } from "./adapter"
import { bucketFor, periodRange } from "./period"

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
