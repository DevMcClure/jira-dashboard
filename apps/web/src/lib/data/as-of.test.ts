import fixture from "@jira-dashboard/core/__fixtures__/pi-export.json"
import { parseExport } from "@jira-dashboard/core/adapter"
import { format } from "date-fns"
import { describe, expect, it } from "vitest"
import { asOfBounds, asOfMoment } from "./as-of"

const dataset = parseExport(fixture)
const day = (d: Date) => format(d, "yyyy-MM-dd")

describe("asOfBounds", () => {
  it("runs from the first day the data covers to the day before its now", () => {
    const bounds = asOfBounds(dataset)!
    expect([day(bounds.first), day(bounds.last)]).toEqual(["2026-09-14", "2026-10-07"])
  })

  it("offers nothing when the data starts on its own last day", () => {
    const fresh = parseExport({ ...fixture, meta: { ...fixture.meta, generatedAt: "2026-09-14T12:00:00Z" } })
    expect(asOfBounds(fresh)).toBeNull()
  })

  it("shows a day at its end", () => {
    expect(asOfMoment(new Date(2026, 9, 14, 9)).getHours()).toBe(23)
  })
})
