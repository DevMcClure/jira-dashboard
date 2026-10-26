import type { StatusCategory, StatusInfo } from "./types"

/** The known workflow, in order. Unknown statuses fall back to their category. */
export const STATUSES: readonly StatusInfo[] = [
  { name: "To Do", category: "todo", colorVar: "--status-todo" },
  { name: "In Progress", category: "in_progress", colorVar: "--status-progress" },
  { name: "In Review", category: "in_progress", colorVar: "--status-review" },
  { name: "Blocked", category: "in_progress", colorVar: "--status-blocked" },
  { name: "QA", category: "in_progress", colorVar: "--status-qa" },
  { name: "Done", category: "done", colorVar: "--status-done" },
]

export const CATEGORY_COLOR_VAR: Record<StatusCategory, string> = {
  todo: "--status-todo",
  in_progress: "--status-progress",
  done: "--status-done",
}

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
}

const KNOWN = new Map(STATUSES.map((s, i) => [s.name, { ...s, order: i }]))

export function knownStatus(name: string) {
  return KNOWN.get(name)
}

export function statusColorVar(status: string, fallbackCategory: StatusCategory): string {
  return KNOWN.get(status)?.colorVar ?? CATEGORY_COLOR_VAR[fallbackCategory]
}

/** Sort key for status names: known workflow order first, then unknown alphabetically. */
export function compareStatus(a: string, b: string): number {
  const ia = KNOWN.get(a)?.order ?? STATUSES.length
  const ib = KNOWN.get(b)?.order ?? STATUSES.length
  return ia - ib || a.localeCompare(b)
}

/**
 * Category for a status name. Known statuses use the workflow table; an unknown
 * status that is the issue's current one uses the issue's `statusCategory`;
 * anything else (only seen in history) is guessed from its name.
 */
export function categoryForStatus(
  status: string,
  issue?: { status: string; statusCategory: StatusCategory },
): StatusCategory {
  const known = KNOWN.get(status)
  if (known) return known.category
  if (issue && issue.status === status) return issue.statusCategory
  if (/done|closed|resolved|released|complete/i.test(status)) return "done"
  if (/to ?do|open|backlog|new|triage|selected/i.test(status)) return "todo"
  return "in_progress"
}

export const ISSUE_TYPES = ["Story", "Bug", "Task", "Sub-task", "Epic", "Spike"] as const
export const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"] as const
