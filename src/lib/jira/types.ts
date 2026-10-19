import type { z } from "zod"
import type { sprintStateSchema, statusCategorySchema } from "./schema"

/** Domain model: what the rest of the app sees. Dates are real `Date`s. */

export type StatusCategory = z.infer<typeof statusCategorySchema>
export type SprintState = z.infer<typeof sprintStateSchema>

export type Meta = {
  source: string | null
  version: string | null
  generatedAt: Date
  jiraBaseUrl: string | null
  query: { teamIds: string[]; sprintIds: number[] }
}

export type Team = {
  id: string
  name: string
  projectKey: string | null
  memberIds: string[]
}

export type Person = {
  id: string
  displayName: string
  email: string | null
  avatarUrl: string | null
}

export type Sprint = {
  id: number
  name: string
  teamId: string | null
  state: SprintState
  goal: string | null
  startDate: Date | null
  endDate: Date | null
  completeDate: Date | null
}

/** Known fields: "status" | "assignee" | "sprint" | "storyPoints" | "priority". */
export type ChangelogEntry = {
  at: Date
  authorId: string | null
  field: string
  from: string | null
  to: string | null
}

export type Issue = {
  key: string
  id: string | null
  summary: string
  description: string | null
  type: string
  status: string
  statusCategory: StatusCategory
  priority: string | null
  assigneeId: string | null
  reporterId: string | null
  teamId: string | null
  sprintIds: number[]
  storyPoints: number | null
  labels: string[]
  epicKey: string | null
  parentKey: string | null
  created: Date
  updated: Date
  resolved: Date | null
  dueDate: Date | null
  /** Sorted ascending by `at`. */
  changelog: ChangelogEntry[]
}

export type Transition = {
  issueKey: string
  at: Date
  authorId: string | null
  from: string | null
  to: string
  /** Time spent in `from` (since the previous status change, or since creation). */
  msInPrevious: number | null
}

export type StatusInfo = {
  name: string
  category: StatusCategory
  /** CSS custom property name, e.g. "--status-done". */
  colorVar: string
}

export type JiraDataset = {
  meta: Meta
  teams: Team[]
  people: Person[]
  sprints: Sprint[]
  issues: Issue[]
  byKey: Map<string, Issue>
  personById: Map<string, Person>
  sprintById: Map<number, Sprint>
  teamById: Map<string, Team>
  /** Flattened status changes across all issues, sorted by time. */
  transitions: Transition[]
  /** Every status seen in the data, in workflow order (known first, then unknown A–Z). */
  statuses: StatusInfo[]
}

export type DateRange = { start: Date; end: Date }
