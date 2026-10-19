import { differenceInMinutes, format } from "date-fns"

/** Compact relative time against a reference "now": "5m ago", "3h ago", "4d ago", "12 Sep". */
export function formatRelative(at: Date, now: Date): string {
  const mins = differenceInMinutes(now, at)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return format(at, "d MMM")
}

/** "2d 4h", "5h", "35m" */
export function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const rem = hours % 24
  return rem ? `${days}d ${rem}h` : `${days}d`
}

export function formatDateTime(d: Date): string {
  return format(d, "EEE d MMM yyyy, HH:mm")
}

export function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
