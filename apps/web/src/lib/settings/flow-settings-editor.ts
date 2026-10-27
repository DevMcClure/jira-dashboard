/**
 * Pure edits for the flow settings page: each takes the settings and returns
 * new ones, so the page keeps a draft and Save sends it whole.
 */
import { categoryForStatus, compareStatus } from "@jira-dashboard/core/constants"
import type { FlowConfig, FlowState, FlowType, WorkingHours } from "@jira-dashboard/core/flowConfig"
import type { StatusCategory, StatusInfo } from "@jira-dashboard/core/types"

const CATEGORY_STATE: Record<StatusCategory, FlowState> = { todo: "not-started", in_progress: "active", done: "done" }

export type StatusRow = {
  name: string
  category: StatusCategory
  /** Set explicitly, or null: it follows its Jira category. */
  state: FlowState | null
  /** What it counts as when not set. */
  fromCategory: FlowState
}

/** Every status in the data, plus any the settings name that the data doesn't have, in workflow order. */
export function statusRows(cfg: FlowConfig, statuses: StatusInfo[]): StatusRow[] {
  const known = new Map(statuses.map((s) => [s.name, s.category]))
  for (const name of Object.keys(cfg.statusStates)) if (!known.has(name)) known.set(name, categoryForStatus(name))
  return [...known]
    .sort(([a], [b]) => compareStatus(a, b))
    .map(([name, category]) => ({ name, category, state: cfg.statusStates[name] ?? null, fromCategory: CATEGORY_STATE[category] }))
}

export function withStatusState(cfg: FlowConfig, status: string, state: FlowState | null): FlowConfig {
  const statusStates = { ...cfg.statusStates }
  if (state) statusStates[status] = state
  else delete statusStates[status]
  return { ...cfg, statusStates }
}

export type TypeRow = {
  name: string
  /** Mapped explicitly, or null: labels decide, otherwise Other. */
  flowType: FlowType | null
  countsAsItem: boolean
}

/** Every issue type in the data, plus any the settings name, A–Z. */
export function typeRows(cfg: FlowConfig, types: string[]): TypeRow[] {
  const names = new Set([...types, ...Object.keys(cfg.typeMap), ...cfg.excludeTypes])
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, flowType: cfg.typeMap[name] ?? null, countsAsItem: !cfg.excludeTypes.includes(name) }))
}

export function withTypeMapping(cfg: FlowConfig, type: string, flowType: FlowType | null): FlowConfig {
  const typeMap = { ...cfg.typeMap }
  if (flowType) typeMap[type] = flowType
  else delete typeMap[type]
  return { ...cfg, typeMap }
}

export function withCountsAsItem(cfg: FlowConfig, type: string, counts: boolean): FlowConfig {
  const rest = cfg.excludeTypes.filter((t) => t !== type)
  return { ...cfg, excludeTypes: counts ? rest : [...rest, type] }
}

/** Add, change or (with null) remove a label rule. Labels match case-insensitively, so they're kept lower-case. */
export function withLabel(cfg: FlowConfig, label: string, flowType: FlowType | null): FlowConfig {
  const key = label.trim().toLowerCase()
  if (!key) return cfg
  const labelTypes = { ...cfg.labelTypes }
  if (flowType) labelTypes[key] = flowType
  else delete labelTypes[key]
  return { ...cfg, labelTypes }
}

export function withWorkingHours(cfg: FlowConfig, patch: Partial<WorkingHours>): FlowConfig {
  const workingHours = { ...cfg.workingHours, ...patch }
  return { ...cfg, workingHours: { ...workingHours, days: [...workingHours.days].sort((a, b) => a - b) } }
}

/** Same settings, whatever order keys and lists are in (to know whether there's anything to save). */
export function sameSettings(a: FlowConfig, b: FlowConfig): boolean {
  const norm = (c: FlowConfig) =>
    JSON.stringify([
      Object.entries(c.statusStates).sort(),
      Object.entries(c.typeMap).sort(),
      Object.entries(c.labelTypes).sort(),
      [...c.excludeTypes].sort(),
      { ...c.workingHours, days: [...c.workingHours.days].sort() },
    ])
  return norm(a) === norm(b)
}
