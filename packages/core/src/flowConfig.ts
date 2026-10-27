/**
 * Flow metric settings: how statuses map to flow states, how Jira types map to
 * flow types, and working hours. Defaults follow docs/decisions/0007; the
 * active settings are editable (the server's, or this browser's in the static
 * build; docs/decisions/0043), validated with `flowConfigSchema`.
 */
import { z } from "zod"
import { categoryForStatus } from "./constants"
import type { Issue, StatusCategory } from "./types"

/** Where an item is in the flow. Waiting = in the workflow but nobody is actively on it. */
export type FlowState = "not-started" | "active" | "waiting" | "done"
export type FlowType = "Feature" | "Defect" | "Risk" | "Debt" | "Other"

export const FLOW_TYPES: readonly FlowType[] = ["Feature", "Defect", "Risk", "Debt", "Other"]
export const FLOW_STATES: readonly FlowState[] = ["not-started", "active", "waiting", "done"]

export type WorkingHours = {
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  days: number[]
  /** Local hours, [start, end). */
  start: number
  end: number
  timeZone: string
}

export type FlowConfig = {
  statusStates: Record<string, FlowState>
  /** Jira type → flow type. Types missing here are "Other" unless a label says otherwise. */
  typeMap: Record<string, FlowType>
  /** Labels that turn a Task / Spike / unmapped type into Debt or Risk. */
  labelTypes: Record<string, FlowType>
  /** Types that aren't flow items (containers and parts of items). */
  excludeTypes: string[]
  workingHours: WorkingHours
}

export const DEFAULT_FLOW_CONFIG: FlowConfig = {
  statusStates: {
    "To Do": "not-started",
    "In Progress": "active",
    QA: "active",
    "In Review": "waiting",
    Blocked: "waiting",
    Done: "done",
  },
  typeMap: { Story: "Feature", Epic: "Feature", Bug: "Defect" },
  labelTypes: { "tech-debt": "Debt", risk: "Risk" },
  excludeTypes: ["Epic", "Sub-task"],
  workingHours: { days: [1, 2, 3, 4, 5], start: 9, end: 18, timeZone: "Europe/London" },
}

const name = z.string().trim().min(1).max(100)
const isTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export const flowConfigSchema = z.object({
  statusStates: z.record(name, z.enum(FLOW_STATES as [FlowState, ...FlowState[]])).refine((r) => Object.keys(r).length <= 200, "Too many statuses"),
  typeMap: z.record(name, z.enum(FLOW_TYPES as [FlowType, ...FlowType[]])).refine((r) => Object.keys(r).length <= 200, "Too many types"),
  /** Keys are matched case-insensitively, so they're stored lower-case. */
  labelTypes: z
    .record(name, z.enum(FLOW_TYPES as [FlowType, ...FlowType[]]))
    .refine((r) => Object.keys(r).length <= 200, "Too many labels")
    .transform((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]))),
  excludeTypes: z.array(name).max(200),
  workingHours: z
    .object({
      days: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one working day").max(7),
      start: z.number().int().min(0).max(23),
      end: z.number().int().min(1).max(24),
      timeZone: z.string().refine(isTimeZone, "Not a time zone"),
    })
    .refine((h) => h.end > h.start, { message: "The working day must end after it starts", path: ["end"] })
    .refine((h) => new Set(h.days).size === h.days.length, { message: "A day is listed twice", path: ["days"] }),
})

/** Settings from untrusted input (storage, the server, an editor), or null if they aren't valid. */
export function parseFlowConfig(raw: unknown): FlowConfig | null {
  const result = flowConfigSchema.safeParse(raw)
  return result.success ? result.data : null
}

/** Readable problems with settings ("workingHours.end: …"), for an editor; empty when they're valid. */
export function flowConfigProblems(raw: unknown): string[] {
  const result = flowConfigSchema.safeParse(raw)
  return result.success ? [] : result.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
}

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`

/** "Mon–Fri 09:00–18:00 (Europe/London)": consecutive days as a range, others listed. */
export function workingHoursLabel({ days, start, end, timeZone }: WorkingHours): string {
  const sorted = [...days].sort((a, b) => a - b)
  const consecutive = sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  const dayText = consecutive ? `${DAY_NAMES[sorted[0]]}–${DAY_NAMES[sorted.at(-1)!]}` : sorted.map((d) => DAY_NAMES[d]).join(", ")
  return `${dayText} ${hh(start)}–${hh(end)} (${timeZone})`
}

/** Unknown statuses fall back to their category (in progress counts as active). */
const CATEGORY_STATE: Record<StatusCategory, FlowState> = {
  todo: "not-started",
  in_progress: "active",
  done: "done",
}

export function flowStateOf(status: string, issue: Pick<Issue, "status" | "statusCategory">, cfg = DEFAULT_FLOW_CONFIG): FlowState {
  return cfg.statusStates[status] ?? CATEGORY_STATE[categoryForStatus(status, issue)]
}

/** The type map wins (a Bug labelled tech-debt is still a Defect); labels only classify the rest. */
export function flowTypeOf(issue: Pick<Issue, "type" | "labels">, cfg = DEFAULT_FLOW_CONFIG): FlowType {
  const mapped = cfg.typeMap[issue.type]
  if (mapped) return mapped
  for (const label of issue.labels) {
    const t = cfg.labelTypes[label.toLowerCase()]
    if (t) return t
  }
  return "Other"
}

export function isFlowItem(issue: Pick<Issue, "type">, cfg = DEFAULT_FLOW_CONFIG): boolean {
  return !cfg.excludeTypes.includes(issue.type)
}
