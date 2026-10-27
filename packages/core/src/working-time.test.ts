import { describe, expect, it } from "vitest"
import { DEFAULT_FLOW_CONFIG } from "./flowConfig"
import { elapsedMs, toDays, zonedTime } from "./working-time"

const H = 3_600_000
const hours = DEFAULT_FLOW_CONFIG.workingHours // Mon–Fri 09:00–18:00 Europe/London
const d = (s: string) => new Date(s)
const working = (a: string, b: string) => elapsedMs(d(a), d(b), "working", hours) / H

describe("zonedTime", () => {
  it("knows London is UTC+1 in summer time and UTC+0 after 25 Oct 2026", () => {
    expect(new Date(zonedTime(2026, 10, 23, 9, "Europe/London")).toISOString()).toBe("2026-10-23T08:00:00.000Z")
    expect(new Date(zonedTime(2026, 10, 26, 9, "Europe/London")).toISOString()).toBe("2026-10-26T09:00:00.000Z")
  })
})

describe("elapsedMs", () => {
  it("calendar time is wall-clock, and never negative", () => {
    expect(elapsedMs(d("2026-10-16T16:00:00Z"), d("2026-10-19T10:00:00Z"), "calendar", hours) / H).toBe(66)
    expect(elapsedMs(d("2026-10-19T10:00:00Z"), d("2026-10-16T16:00:00Z"), "calendar", hours)).toBe(0)
  })

  it("counts working hours within a day", () => {
    // Mon 19 Oct (BST): 10:00–14:00 London = 09:00–13:00Z.
    expect(working("2026-10-19T09:00:00Z", "2026-10-19T13:00:00Z")).toBe(4)
  })

  it("skips nights", () => {
    // Mon 16:00 → Tue 11:00 London: 2 h Monday + 2 h Tuesday.
    expect(working("2026-10-19T15:00:00Z", "2026-10-20T10:00:00Z")).toBe(4)
  })

  it("skips weekends: a Friday-evening review isn't 60+ hours of queue", () => {
    // Fri 16 Oct 17:00 London → Mon 19 Oct 10:00 London: 1 h Friday + 1 h Monday.
    expect(working("2026-10-16T16:00:00Z", "2026-10-19T09:00:00Z")).toBe(2)
  })

  it("ignores time outside working hours at both ends", () => {
    // Tue 06:00 → 20:00 London is one full 9 h day.
    expect(working("2026-10-20T05:00:00Z", "2026-10-20T19:00:00Z")).toBe(9)
  })

  it("follows the clock change on Sunday 25 Oct", () => {
    // Fri 23 Oct 17:00 London (16:00Z) → Mon 26 Oct 10:00 London (10:00Z, now GMT): 1 h + 1 h.
    expect(working("2026-10-23T16:00:00Z", "2026-10-26T10:00:00Z")).toBe(2)
  })
})

describe("toDays", () => {
  it("uses a 9 h working day, or a 24 h calendar day", () => {
    expect(toDays(18 * H, "working", hours)).toBe(2)
    expect(toDays(36 * H, "calendar", hours)).toBe(1.5)
  })
})
