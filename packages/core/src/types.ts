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
  piId: string | null
}

/** A program increment: ~10 weeks / 5 sprints, with the same dates for every team. */
export type ProgramIncrement = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  state: SprintState
  objectives: Objective[]
  /** Every team's sprints in this PI, sorted by start. */
  sprintIds: number[]
}

/** A PI objective; progress rolls up from its epics' stories and any directly linked issues. */
export type Objective = {
  id: string
  piId: string
  /** null = ART level (the whole train). */
  teamId: string | null
  title: string
  description: string | null
  ownerId: string | null
  committed: boolean
  /** 0–10, or null when not set. Actual is only known once the PI is assessed. */
  plannedBusinessValue: number | null
  actualBusinessValue: number | null
  epicKeys: string[]
  issueKeys: string[]
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
  /** Sorted by start; empty when the export has no PIs. */
  programIncrements: ProgramIncrement[]
  issues: Issue[]
  byKey: Map<string, Issue>
  personById: Map<string, Person>
  sprintById: Map<number, Sprint>
  teamById: Map<string, Team>
  piById: Map<string, ProgramIncrement>
  /** Every PI's objectives by id. */
  objectiveById: Map<string, Objective>
  /** Every Jira issue of type "Objective" → its linked epics' keys, in a PI or not (decision 0050). */
  objectiveEpics: Map<string, string[]>
  /** Flattened status changes across all issues, sorted by time. */
  transitions: Transition[]
  /** Every status seen in the data, in workflow order (known first, then unknown A–Z). */
  statuses: StatusInfo[]
}

export type DateRange = { start: Date; end: Date }
