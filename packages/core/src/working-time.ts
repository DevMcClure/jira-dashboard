/**
 * Elapsed time between two instants, either on the calendar or counting only
 * working hours in a time zone (DST-aware, via Intl; no date-tz dependency).
 */
import type { WorkingHours } from "./flowConfig"

export type TimeMode = "working" | "calendar"

const HOUR = 3_600_000
const DAY = 24 * HOUR

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string) {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** Wall-clock parts of `instant` in `timeZone`. */
function localParts(instant: number, timeZone: string) {
  const p: Record<string, number> = {}
  for (const { type, value } of formatter(timeZone).formatToParts(instant)) {
    if (type !== "literal") p[type] = Number(value)
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second }
}

// Intl lookups are slow, and flow metrics make thousands of them. Offsets only
// change on hour boundaries (true for London and nearly every zone), so cache
// them per hour, and cache each local hour's instant.
const offsetCache = new Map<string, number>()
const zonedCache = new Map<string, number>()

/** Local time minus UTC, in ms, at `instant`. */
function offsetAt(instant: number, timeZone: string): number {
  const key = `${timeZone}|${Math.floor(instant / HOUR)}`
  let offset = offsetCache.get(key)
  if (offset === undefined) {
    const { y, m, d, h, min, s } = localParts(instant, timeZone)
    offset = Date.UTC(y, m - 1, d, h, min, s) - Math.floor(instant / 1000) * 1000
    offsetCache.set(key, offset)
  }
  return offset
}

/** Local calendar date of `instant` in `timeZone`. */
function localDate(instant: number, timeZone: string) {
  const local = new Date(instant + offsetAt(instant, timeZone))
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() }
}

/** The instant at local date y-m-d, hour h in `timeZone`. */
export function zonedTime(y: number, m: number, d: number, h: number, timeZone: string): number {
  const key = `${timeZone}|${y}-${m}-${d}-${h}`
  let instant = zonedCache.get(key)
  if (instant === undefined) {
    const guess = Date.UTC(y, m - 1, d, h)
    const first = guess - offsetAt(guess, timeZone)
    // Re-check once in case the guess and the answer sit either side of a clock change.
    instant = guess - offsetAt(first, timeZone)
    zonedCache.set(key, instant)
  }
  return instant
}

/** Working-hours overlap of [from, to]: each local working day's window, clipped. */
function workingMs(from: number, to: number, hours: WorkingHours): number {
  const { timeZone } = hours
  const start = localDate(from, timeZone)
  const end = localDate(to, timeZone)
  const last = Date.UTC(end.y, end.m - 1, end.d)
  let total = 0
  for (let day = Date.UTC(start.y, start.m - 1, start.d); day <= last; day += DAY) {
    const date = new Date(day)
    const isoWeekday = date.getUTCDay() || 7
    if (!hours.days.includes(isoWeekday)) continue
    const y = date.getUTCFullYear()
    const m = date.getUTCMonth() + 1
    const d = date.getUTCDate()
    const open = zonedTime(y, m, d, hours.start, timeZone)
    const close = zonedTime(y, m, d, hours.end, timeZone)
    total += Math.max(0, Math.min(close, to) - Math.max(open, from))
  }
  return total
}

/** Time from `from` to `to` (0 if reversed): wall-clock, or working hours only. */
export function elapsedMs(from: Date, to: Date, mode: TimeMode, hours: WorkingHours): number {
  const a = from.getTime()
  const b = to.getTime()
  if (b <= a) return 0
  return mode === "calendar" ? b - a : workingMs(a, b, hours)
}

/** Ms → days: a working day is one working-hours window (9 h by default), a calendar day 24 h. */
export function toDays(ms: number, mode: TimeMode, hours: WorkingHours): number {
  return ms / (mode === "calendar" ? DAY : (hours.end - hours.start) * HOUR)
}

export const TIME_MODE_LABEL: Record<TimeMode, string> = {
  working: "Working hours",
  calendar: "Calendar time",
}
