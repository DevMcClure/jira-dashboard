import type { FlowState } from "@jira-dashboard/core/flowConfig"
import type { StatusCategory } from "@jira-dashboard/core/types"

export const STATE_LABEL: Record<FlowState, string> = { "not-started": "Not started", active: "Active", waiting: "Waiting", done: "Done" }
export const CATEGORY_LABEL: Record<StatusCategory, string> = { todo: "To do", in_progress: "In progress", done: "Done" }
