import { z } from "zod"

/**
 * Zod schemas for the raw Jira Trawler export (see docs/02-DATA_CONTRACT.md).
 *
 * Strict on the fields the dashboard can't work without; lenient
 * (`.nullable().optional()`) on everything else. Objects are loose so extra
 * Trawler fields pass through without breaking validation.
 */

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid ISO date" })

const optionalIsoDate = isoDate.nullable().optional()
const optionalString = z.string().nullable().optional()

/** Changelog values can be names, ids or numbers depending on the field. */
const changelogValue = z.union([z.string(), z.number()]).nullable().optional()

export const statusCategorySchema = z.enum(["todo", "in_progress", "done"])
export const sprintStateSchema = z.enum(["future", "active", "closed"])

export const changelogEntrySchema = z.looseObject({
  at: isoDate,
  authorId: optionalString,
  field: z.string(),
  from: changelogValue,
  to: changelogValue,
})

export const issueSchema = z.looseObject({
  key: z.string().min(1),
  id: z.union([z.string(), z.number()]).nullable().optional(),
  summary: z.string(),
  description: optionalString,
  type: optionalString,
  status: z.string().min(1),
  statusCategory: statusCategorySchema,
  priority: optionalString,
  assigneeId: optionalString,
  reporterId: optionalString,
  teamId: optionalString,
  sprintIds: z.array(z.number()).nullable().optional(),
  storyPoints: z.number().nullable().optional(),
  labels: z.array(z.string()).nullable().optional(),
  epicKey: optionalString,
  parentKey: optionalString,
  created: isoDate,
  updated: optionalIsoDate,
  resolved: optionalIsoDate,
  dueDate: optionalIsoDate,
  changelog: z.array(changelogEntrySchema).nullable().optional(),
})

export const sprintSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  teamId: optionalString,
  state: sprintStateSchema,
  goal: optionalString,
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
  completeDate: optionalIsoDate,
  /** Program increment this sprint belongs to; inferred from dates when missing. */
  piId: optionalString,
})

/** Business value is meant to be 1–10; anything else is read as "not set" by the adapter. */
const businessValue = z.number().nullable().optional()

/** A PI objective. `teamId` null/missing = ART level. Progress rolls up from `epicKeys` / `issueKeys`. */
export const objectiveSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string(),
  piId: optionalString,
  teamId: optionalString,
  description: optionalString,
  ownerId: optionalString,
  committed: z.boolean().nullable().optional(),
  plannedBusinessValue: businessValue,
  actualBusinessValue: businessValue,
  epicKeys: z.array(z.string()).nullable().optional(),
  issueKeys: z.array(z.string()).nullable().optional(),
})

/** A program increment (PI): ~10 weeks / 5 sprints, shared by every team. */
export const programIncrementSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  state: sprintStateSchema.nullable().optional(),
  /** Plain strings (older exports) or full objectives. */
  objectives: z.array(z.union([z.string(), objectiveSchema])).nullable().optional(),
})

export const personSchema = z.looseObject({
  id: z.string(),
  displayName: z.string(),
  email: optionalString,
  avatarUrl: optionalString,
})

export const teamSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  projectKey: optionalString,
  memberIds: z.array(z.string()).nullable().optional(),
})

export const metaSchema = z.looseObject({
  source: optionalString,
  version: optionalString,
  generatedAt: optionalIsoDate,
  jiraBaseUrl: optionalString,
  query: z
    .looseObject({
      teamIds: z.array(z.string()).nullable().optional(),
      sprintIds: z.array(z.number()).nullable().optional(),
    })
    .nullable()
    .optional(),
})

export const exportSchema = z.looseObject({
  meta: metaSchema.nullable().optional(),
  teams: z.array(teamSchema).nullable().optional(),
  people: z.array(personSchema).nullable().optional(),
  sprints: z.array(sprintSchema).nullable().optional(),
  programIncrements: z.array(programIncrementSchema).nullable().optional(),
  issues: z.array(issueSchema),
})

export type RawExport = z.infer<typeof exportSchema>
export type RawIssue = z.infer<typeof issueSchema>
export type RawObjective = z.infer<typeof objectiveSchema>
export type RawChangelogEntry = z.infer<typeof changelogEntrySchema>
