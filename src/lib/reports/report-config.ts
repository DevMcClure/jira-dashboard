/**
 * A saved dashboard view ("report"). Versioned and validated with zod on every
 * read: from localStorage, from a shared link, and later from the server, where
 * it's stored unchanged (docs/decisions/0005, 0018).
 */
import { z } from "zod"
import { PERIODS, type Period } from "../jira/period"
import type { Scope } from "../jira/scope"
import type { DateRange } from "../jira/types"

/** The pages a report can include: the "Explore the Sprints" group. */
export const REPORT_PAGES = [
  { id: "overview", path: "/", title: "Overview" },
  { id: "pi", path: "/pi", title: "PI" },
  { id: "objectives", path: "/objectives", title: "Objectives" },
  { id: "details", path: "/details", title: "Details" },
  { id: "health", path: "/health", title: "Health" },
  { id: "tickets", path: "/tickets", title: "Tickets" },
  { id: "sprints", path: "/sprints", title: "Sprints" },
  { id: "people", path: "/people", title: "People" },
  { id: "movements", path: "/movements", title: "Movements" },
  { id: "flow", path: "/flow", title: "Flow" },
] as const

export type ReportPageId = (typeof REPORT_PAGES)[number]["id"]
const PAGE_IDS = REPORT_PAGES.map((p) => p.id) as [ReportPageId, ...ReportPageId[]]

/** Pages a new report includes unless the author changes them (answered open question, 26 Oct 2026). */
export const DEFAULT_REPORT_PAGES: ReportPageId[] = ["overview", "details", "pi", "objectives", "flow"]
/** Pages that only make sense when the export has PIs. */
export const PI_PAGES: ReportPageId[] = ["pi", "objectives"]

export function pagePath(id: ReportPageId): string {
  return REPORT_PAGES.find((p) => p.id === id)!.path
}

/** The report page a path belongs to ("/teams/WEB" → overview, "/tickets/X-1" → tickets), or null. */
export function pageForPath(path: string): ReportPageId | null {
  if (path === "/" || path === "" || path.startsWith("/teams/")) return "overview"
  const page = REPORT_PAGES.find((p) => p.path !== "/" && (path === p.path || path.startsWith(`${p.path}/`)))
  return page?.id ?? null
}

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid ISO date" })
const PERIOD_VALUES = PERIODS.map((p) => p.value) as [Period, ...Period[]]

export const reportConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1, "Give the report a title").max(120),
    note: z.string().max(2000).default(""),
    /** Free text until sign-in exists (decision 0010). */
    author: z.string().trim().max(80).default(""),
    kind: z.enum(["live", "frozen"]),
    scope: z.enum(["sprint", "pi"]),
    piId: z.string().nullable().default(null),
    sprintIds: z.array(z.number().int()).max(500).default([]),
    teamIds: z.array(z.string()).max(500).default([]),
    /** null = Unassigned. */
    assigneeIds: z.array(z.string().nullable()).max(1000).default([]),
    period: z.enum(PERIOD_VALUES),
    /** Frozen reports, and any custom period, pin the dates here. */
    from: iso.optional(),
    to: iso.optional(),
    pages: z.array(z.enum(PAGE_IDS)).min(1, "Include at least one page"),
    landingPage: z.enum(PAGE_IDS),
    /** The export's generatedAt when the report was saved. */
    dataStamp: iso,
  })
  .superRefine((c, ctx) => {
    if (!c.pages.includes(c.landingPage)) {
      ctx.addIssue({ code: "custom", path: ["landingPage"], message: "The landing page must be one of the report's pages" })
    }
    if ((c.kind === "frozen" || c.period === "custom") && (!c.from || !c.to)) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "A frozen report or custom range needs fixed dates" })
    }
    if (c.scope === "pi" && !c.piId) {
      ctx.addIssue({ code: "custom", path: ["piId"], message: "A PI report needs a PI" })
    }
  })

export type ReportConfig = z.output<typeof reportConfigSchema>
export type ReportKind = ReportConfig["kind"]

/** A config from untrusted input (storage, a link), or null if it isn't a valid v1 config. */
export function parseReportConfig(raw: unknown): ReportConfig | null {
  const result = reportConfigSchema.safeParse(raw)
  return result.success ? result.data : null
}

// ---------------------------------------------------------------------------
// View ↔ config
// ---------------------------------------------------------------------------

export type ViewFilters = { sprintIds: number[]; teamIds: string[]; assigneeIds: (string | null)[] }

/** What the dashboard is showing right now. */
export type DashboardView = {
  filters: ViewFilters
  scope: Scope
  period: Period
  /** The period resolved to dates (frozen reports pin these). */
  range: DateRange
  generatedAt: Date
}

export type ReportDetails = {
  title: string
  note?: string
  author?: string
  kind: ReportKind
  pages: ReportPageId[]
  landingPage: ReportPageId
}

export function configFromView(view: DashboardView, details: ReportDetails): ReportConfig {
  // A custom range is absolute, so even a live report keeps its dates.
  const pinned = details.kind === "frozen" || view.period === "custom"
  return reportConfigSchema.parse({
    schemaVersion: 1,
    ...details,
    scope: view.scope.kind,
    piId: view.scope.kind === "pi" ? view.scope.piId : null,
    sprintIds: view.filters.sprintIds,
    teamIds: view.filters.teamIds,
    assigneeIds: view.filters.assigneeIds,
    period: view.period,
    ...(pinned ? { from: view.range.start.toISOString(), to: view.range.end.toISOString() } : {}),
    dataStamp: view.generatedAt.toISOString(),
  })
}

/** The dashboard state a report puts in place. Frozen reports and custom periods carry fixed dates. */
export function viewFromConfig(config: ReportConfig) {
  const scope: Scope = config.scope === "pi" && config.piId ? { kind: "pi", piId: config.piId } : { kind: "sprint" }
  return {
    filters: { sprintIds: config.sprintIds, teamIds: config.teamIds, assigneeIds: config.assigneeIds } satisfies ViewFilters,
    scope,
    period: config.period,
    fixedRange:
      (config.kind === "frozen" || config.period === "custom") && config.from && config.to
        ? ({ start: new Date(config.from), end: new Date(config.to) } satisfies DateRange)
        : null,
  }
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** Anything longer isn't a report we made; refuse it before parsing. */
const MAX_CODE_LENGTH = 16_000

/** Config → URL-safe base64 of its UTF-8 JSON. */
export function encodeReportConfig(config: ReportConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(config))
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** A link's code → config, or null for anything tampered, truncated or invalid. Never throws. */
export function decodeReportConfig(code: string | null | undefined): ReportConfig | null {
  if (!code || code.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  try {
    const base64 = code.replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
    return parseReportConfig(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
  } catch {
    return null
  }
}

/** The shareable link: `<origin><base>r?c=<code>`. `base` is Vite's BASE_URL ("/" or "/jira-dashboard/"). */
export function reportLink(config: ReportConfig, origin: string, base: string): string {
  return `${origin}${base.endsWith("/") ? base : `${base}/`}r?c=${encodeReportConfig(config)}`
}
