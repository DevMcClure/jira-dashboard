import { describe, expect, it } from "vitest"
import { formatDuration, formatRelative, initials } from "./format"

describe("format", () => {
  const now = new Date("2026-10-19T08:00:00Z")
  it("formatRelative", () => {
    expect(formatRelative(new Date("2026-10-19T07:55:00Z"), now)).toBe("5m ago")
    expect(formatRelative(new Date("2026-10-19T05:00:00Z"), now)).toBe("3h ago")
    expect(formatRelative(new Date("2026-10-15T08:00:00Z"), now)).toBe("4d ago")
    expect(formatRelative(new Date("2026-08-01T08:00:00Z"), now)).toBe("1 Aug")
  })
  it("formatDuration", () => {
    expect(formatDuration(35 * 60_000)).toBe("35m")
    expect(formatDuration(5 * 3_600_000)).toBe("5h")
    expect(formatDuration(52 * 3_600_000)).toBe("2d 4h")
  })
  it("initials", () => {
    expect(initials("Priya Shah")).toBe("PS")
    expect(initials("Liam O'Brien")).toBe("LO")
    expect(initials("Unknown (u-3)")).toBe("U")
  })
})
