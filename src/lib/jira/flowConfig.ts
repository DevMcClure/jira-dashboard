/**
 * Flow metric settings: how statuses map to flow states, how Jira types map to
 * flow types, and working hours. Defaults follow docs/decisions/0007. This file
 * becomes an editable settings page on the server later; keep it plain data.
 */
import { categoryForStatus } from "./constants"
import type { Issue, StatusCategory } from "./types"

/** Where an item is in the flow. Waiting = in the workflow but nobody is actively on it. */
export type FlowState = "not-started" | "active" | "waiting" | "done"
export type FlowType = "Feature" | "Defect" | "Risk" | "Debt" | "Other"

export const FLOW_TYPES: readonly FlowType[] = ["Feature", "Defect", "Risk", "Debt", "Other"]

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
