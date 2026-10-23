/**
 * Deterministic mock Jira Trawler export → src/data/jira-export.json
 *
 *   npm run mock:data
 *
 * Seeded (mulberry32, seed 42) so the committed JSON is stable. See
 * docs/02-DATA_CONTRACT.md → "Mock data generator" for the spec.
 */
import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(42)
const chance = (p: number) => rand() < p
const between = (lo: number, hi: number) => lo + rand() * (hi - lo)
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1))
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
function weighted<T>(pairs: readonly (readonly [T, number])[]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [v, w] of pairs) {
    if ((r -= w) < 0) return v
  }
  return pairs[pairs.length - 1][0]
}

// ---------------------------------------------------------------------------
// Working-time helpers (UTC, weekdays 09:00–18:00)
// ---------------------------------------------------------------------------

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WORK_START = 9
const WORK_END = 18

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6
const atHour = (d: Date, h: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h))

/** Snap forward to the next moment inside working hours. */
function toWorkTime(d: Date): Date {
  let t = new Date(d)
  for (;;) {
    if (isWeekend(t)) t = atHour(new Date(t.getTime() + DAY), WORK_START)
    else if (t.getUTCHours() < WORK_START) t = atHour(t, WORK_START)
    else if (t >= atHour(t, WORK_END)) t = atHour(new Date(t.getTime() + DAY), WORK_START)
    else return t
  }
}

function addWorkingHours(d: Date, hours: number): Date {
  let t = toWorkTime(d)
  let remaining = hours * HOUR
  for (;;) {
    const avail = atHour(t, WORK_END).getTime() - t.getTime()
    if (remaining < avail) return new Date(t.getTime() + remaining)
    remaining -= avail
    t = toWorkTime(atHour(new Date(t.getTime() + DAY), WORK_START))
  }
}

function workingHoursBetween(a: Date, b: Date): number {
  let total = 0
  let t = toWorkTime(a)
  while (t < b) {
    const dayEnd = atHour(t, WORK_END)
    const end = dayEnd < b ? dayEnd : b
    total += Math.max(0, end.getTime() - t.getTime())
    t = toWorkTime(atHour(new Date(t.getTime() + DAY), WORK_START))
  }
  return total / HOUR
}

/** A random working-hours timestamp `daysBack` calendar days before `d`. */
function workTimeBefore(d: Date, daysBack: number): Date {
  return addWorkingHours(new Date(d.getTime() - daysBack * DAY), between(0, 8.5))
}

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z")

// ---------------------------------------------------------------------------
// Static world
// ---------------------------------------------------------------------------

const GENERATED_AT = new Date("2026-10-19T17:00:00Z") // Monday, end of the working day
/** Active sprints started Mon 12 Oct → ~60% elapsed at GENERATED_AT. */
const ACTIVE_START = new Date("2026-10-12T09:00:00Z")

/**
 * Two PIs of 5 two-week sprints, shared by every team. Sprint index 8 (the 4th
 * of PI 26.4) is active, index 9 is future, everything before is closed.
 */
const SPRINTS_PER_PI = 5
const ACTIVE_INDEX = 8
const SPRINT_COUNT = 10

type PiDef = { id: string; name: string; objectives: string[] }
const PIS: PiDef[] = [
  {
    id: "PI-26.3",
    name: "PI 26.3",
    objectives: [
      "Launch usage-based billing to all paying tenants",
      "Onboarding redesign in beta for new sign-ups",
      "Rich push notifications on iOS and Android",
    ],
  },
  {
    id: "PI-26.4",
    name: "PI 26.4",
    objectives: [
      "Enterprise readiness: SSO, SCIM and audit logs",
      "Web performance: p75 LCP under 2.5s",
      "Mobile 4.2 with offline mode and widgets",
    ],
  },
]

type PersonDef = { id: string; displayName: string }
type TeamDef = {
  id: string
  name: string
  projectKey: string
  firstKey: number
  sprintBase: number
  memberIds: string[]
  labels: string[]
  /** [key, name] per PI, oldest PI first. */
  epics: [string, string][][]
  summaries: Record<"Story" | "Bug" | "Task" | "Spike", string[]>
}

const PEOPLE: PersonDef[] = [
  { id: "u-01", displayName: "Priya Shah" },
  { id: "u-02", displayName: "Marcus Chen" },
  { id: "u-03", displayName: "Elena Rossi" },
  { id: "u-04", displayName: "Tomás García" },
  { id: "u-05", displayName: "Aisha Bello" },
  { id: "u-06", displayName: "Sofia Lindqvist" },
  { id: "u-07", displayName: "Jamal Wright" },
  { id: "u-08", displayName: "Hannah Okafor" },
  { id: "u-09", displayName: "Liam O'Brien" },
  { id: "u-10", displayName: "Kenji Watanabe" },
  { id: "u-11", displayName: "Fatima Haddad" },
  { id: "u-12", displayName: "Noah Fischer" },
  { id: "u-13", displayName: "Grace Mensah" },
  { id: "u-14", displayName: "Ravi Iyer" },
]

const TEAMS: TeamDef[] = [
  {
    id: "TEAM-PLAT",
    name: "Platform",
    projectKey: "PLAT",
    firstKey: 1201,
    sprintBase: 101,
    memberIds: ["u-01", "u-02", "u-03", "u-04", "u-05"],
    labels: ["billing", "auth", "api", "infra", "webhooks", "observability"],
    epics: [
      [["PLAT-1020", "Usage-based billing"], ["PLAT-1041", "Webhooks v2"], ["PLAT-1077", "Secrets rotation"]],
      [["PLAT-1100", "Enterprise SSO & SCIM"], ["PLAT-1105", "Rate limits v2"], ["PLAT-1142", "Audit logging"]],
    ],
    summaries: {
      Story: [
        "Retry failed webhook deliveries with exponential backoff",
        "Sign outgoing webhooks with rotating secrets",
        "Expose per-tenant API rate limits in admin settings",
        "Return Retry-After headers when rate limited",
        "Support SAML SSO for enterprise tenants",
        "Add refresh-token rotation to OAuth flow",
        "Emit usage metering events for billable API calls",
        "Generate monthly invoice PDFs",
        "Sync Stripe customer records nightly",
        "Prorate plan changes mid billing cycle",
        "Add idempotency keys to payments API",
        "Audit log for admin permission changes",
        "Self-serve API key management",
        "Tenant data export endpoint (GDPR)",
        "Paginate the /v2/events endpoint",
        "Webhook delivery dashboard for customers",
        "Dunning emails for failed card payments",
        "Scoped API tokens with read-only permissions",
        "Regional data residency for EU tenants",
        "Usage alerts when tenants hit 80% of quota",
        "Bulk user provisioning via SCIM",
        "Add multi-currency support to invoices",
        "Credit notes for partial refunds",
        "Session revocation from security settings",
        "Feature flags service for gradual rollouts",
      ],
      Bug: [
        "Webhook retries fire twice after worker restart",
        "Rate limiter counts OPTIONS preflight requests",
        "Invoice totals off by one cent with VAT rounding",
        "OAuth callback fails when state param contains '+'",
        "SAML assertion clock-skew errors for some IdPs",
        "Stripe sync drops customers with unicode names",
        "Audit log timestamps missing timezone",
        "API returns 500 instead of 404 for deleted tenants",
        "Password reset tokens never expire",
        "Usage metering double counts batch requests",
        "Proration credit applied to wrong invoice",
        "Expired API keys still pass auth for 5 minutes",
      ],
      Task: [
        "Upgrade Postgres from 15 to 17",
        "Migrate background jobs to the new queue",
        "Rotate production database credentials",
        "Add OpenTelemetry tracing to billing service",
        "Bump Node runtime to v22 across services",
        "Tune connection pool sizes for API pods",
        "Remove deprecated /v1/auth endpoints",
        "Set up alerting for webhook failure rate",
        "Document rate limit tiers in API reference",
        "Load test the payments API at 2x peak",
        "Clean up orphaned S3 export files",
        "Move secrets to the managed vault",
        "Add SLO dashboard for auth latency",
        "Archive billing events older than 2 years",
        "Terraform the staging Redis cluster",
      ],
      Spike: [
        "Evaluate usage-based billing providers",
        "Investigate passkey support for login",
        "Compare queue options for webhook fan-out",
        "Prototype per-tenant encryption keys",
      ],
    },
  },
  {
    id: "TEAM-WEB",
    name: "Web",
    projectKey: "WEB",
    firstKey: 841,
    sprintBase: 201,
    memberIds: ["u-06", "u-07", "u-08", "u-09", "u-03", "u-14"],
    labels: ["dashboard", "onboarding", "a11y", "frontend", "search", "perf"],
    epics: [
      [["WEB-610", "Onboarding redesign"], ["WEB-633", "Saved views"], ["WEB-668", "Design system tokens"]],
      [["WEB-700", "Core Web Vitals"], ["WEB-722", "Accessibility AA"], ["WEB-790", "Global search"]],
    ],
    summaries: {
      Story: [
        "Redesign onboarding checklist",
        "Add saved views to the analytics dashboard",
        "Dark mode for the account settings pages",
        "Inline editing for project names",
        "Keyboard shortcuts for the command palette",
        "Global search across projects and people",
        "Invite teammates during onboarding",
        "Empty states for new workspaces",
        "Export dashboard widgets as PNG",
        "Drag-and-drop dashboard layout",
        "Notification preferences page",
        "Show billing usage chart on account page",
        "Bulk archive from the projects table",
        "Date range picker with presets",
        "In-app changelog popover",
        "Shareable read-only dashboard links",
        "Guided tour for first-time admins",
        "Filter chips on the activity feed",
        "Recently viewed items in the sidebar",
        "Team switcher in the header",
        "Responsive layout for tablet widths",
        "Profile avatars with initials fallback",
        "CSV import wizard for contacts",
        "Undo toast after deleting a widget",
        "Accessible focus states across forms",
      ],
      Bug: [
        "Dashboard charts flicker when resizing window",
        "Search results lose highlight after pagination",
        "Onboarding step 3 skips when pressing Enter",
        "Date picker shows wrong week start for en-GB",
        "Modal traps focus after closing with Escape",
        "Table sort resets when filters change",
        "Avatar images blurry on retina screens",
        "Sidebar collapses unexpectedly on route change",
        "Tooltips clipped inside scroll containers",
        "Login redirect loops on expired session",
        "Toast stack overlaps the cookie banner",
        "Settings form allows submitting twice",
      ],
      Task: [
        "Upgrade to React 19",
        "Migrate styles to Tailwind v4",
        "Add Lighthouse CI budget checks",
        "Remove moment.js in favour of date-fns",
        "Set up visual regression tests",
        "Audit bundle size of the dashboard route",
        "Add Sentry release tracking",
        "Write Storybook stories for form inputs",
        "Replace custom tooltip with shared component",
        "Enable strict TypeScript in legacy pages",
        "Run axe accessibility audit on onboarding",
        "Lazy-load chart library",
        "Clean up unused feature flags",
        "Add e2e smoke test for sign-up",
        "Document design tokens",
      ],
      Spike: [
        "Evaluate server components for marketing pages",
        "Investigate virtualised tables for 10k rows",
        "Prototype AI summary widget",
        "Assess i18n library options",
      ],
    },
  },
  {
    id: "TEAM-MOB",
    name: "Mobile",
    projectKey: "MOB",
    firstKey: 521,
    sprintBase: 301,
    memberIds: ["u-10", "u-11", "u-12", "u-13"],
    labels: ["ios", "android", "push", "offline", "release", "perf"],
    epics: [
      [["MOB-322", "Rich push notifications"], ["MOB-345", "Deep links"], ["MOB-371", "Crash-free sessions 99.5%"]],
      [["MOB-400", "Offline mode"], ["MOB-431", "Home screen widgets"], ["MOB-466", "Release 4.2"]],
    ],
    summaries: {
      Story: [
        "Rich push notifications with images",
        "Offline mode for the task list",
        "Biometric login on iOS and Android",
        "Deep links from email into the app",
        "In-app notification inbox",
        "Quiet hours for push notifications",
        "Pull-to-refresh on the activity feed",
        "Home screen widget for today's tasks",
        "Share sheet integration for attachments",
        "Background sync for edited items",
        "Camera upload with image compression",
        "Haptic feedback on key actions",
        "Onboarding carousel for new users",
        "App rating prompt after 5 sessions",
        "Dark mode follows system setting",
        "Tablet split-view layout",
        "Voice notes on tasks",
        "Swipe actions on list rows",
        "Force-update prompt for old versions",
        "Location reminders for tasks",
        "Push notification grouping by project",
        "Accessibility labels for all icons",
        "Offline conflict resolution UI",
        "Apple Watch quick-complete",
        "Localised push notification copy",
      ],
      Bug: [
        "Push tokens not refreshed after reinstall",
        "Crash on Android 12 when opening camera",
        "Offline queue replays edits out of order",
        "Keyboard covers the comment field on iOS",
        "Deep link opens wrong workspace",
        "Biometric prompt shown twice on resume",
        "Images rotate incorrectly from front camera",
        "Badge count not cleared after reading",
        "App freezes when switching accounts",
        "Widget shows stale data after logout",
        "Dark mode text unreadable on settings",
        "Notifications arrive during quiet hours",
      ],
      Task: [
        "Upgrade React Native to 0.80",
        "Migrate push to FCM HTTP v1 API",
        "Set up Fastlane for TestFlight builds",
        "Add crash-free sessions dashboard",
        "Reduce app bundle size below 40MB",
        "Rotate APNs signing certificate",
        "Automate Play Store screenshots",
        "Enable Hermes on iOS",
        "Add Detox smoke tests to CI",
        "Update privacy manifest for iOS 18",
        "Remove legacy analytics SDK",
        "Profile cold start time on low-end Android",
        "Document release checklist",
        "Bump minimum iOS version to 16",
        "Clean up unused image assets",
      ],
      Spike: [
        "Evaluate Expo for new modules",
        "Investigate live activities on iOS",
        "Prototype offline-first sync engine",
        "Compare crash reporting vendors",
      ],
    },
  },
]

// ---------------------------------------------------------------------------
// Raw export types (the shape in docs/02-DATA_CONTRACT.md)
// ---------------------------------------------------------------------------

type SprintState = "future" | "active" | "closed"
type RawSprint = {
  id: number
  name: string
  teamId: string
  state: SprintState
  goal: string
  startDate: string
  endDate: string
  completeDate: string | null
  piId: string
}
type RawChange = { at: string; authorId: string | null; field: string; from: string | null; to: string | null }
type IssueType = "Story" | "Bug" | "Task" | "Spike"
type RawIssue = Omit<RawIssueBase, "type"> & { type: IssueType | "Epic" }
type RawIssueBase = {
  key: string
  id: string
  summary: string
  description: string | null
  type: IssueType
  status: string
  statusCategory: "todo" | "in_progress" | "done"
  priority: string
  assigneeId: string | null
  reporterId: string
  teamId: string
  sprintIds: number[]
  storyPoints: number | null
  labels: string[]
  epicKey: string | null
  parentKey: string | null
  created: string
  updated: string
  resolved: string | null
  dueDate: string | null
  changelog: RawChange[]
}

const CATEGORY: Record<string, RawIssue["statusCategory"]> = {
  "To Do": "todo",
  "In Progress": "in_progress",
  "In Review": "in_progress",
  Blocked: "in_progress",
  QA: "in_progress",
  Done: "done",
}

/** One goal per sprint, oldest first. */
const SPRINT_GOALS: Record<string, string[]> = {
  "TEAM-PLAT": [
    "Metering pipeline foundations",
    "Usage-based pricing in the API",
    "Webhooks v2 delivery guarantees",
    "Billing migration for existing tenants",
    "Secrets rotation and hardening",
    "SAML SSO for enterprise tenants",
    "Ship the new billing webhooks",
    "Harden auth and rotate secrets",
    "Rate limits v2 and usage metering",
    "Invoices and dunning polish",
  ],
  "TEAM-WEB": [
    "Onboarding research and wireframes",
    "Onboarding checklist and empty states",
    "Design tokens across the app",
    "Saved views foundations",
    "Onboarding redesign GA prep",
    "Performance budget and monitoring",
    "Onboarding redesign beta",
    "Dashboard saved views",
    "Accessibility and performance pass",
    "Search everywhere",
  ],
  "TEAM-MOB": [
    "Push notification service",
    "Rich push on iOS",
    "Rich push on Android",
    "Deep links and universal links",
    "Crash-rate burn-down",
    "Offline storage spike and plan",
    "Rich push notifications",
    "Offline mode foundations",
    "Release 4.2 stabilisation",
    "Widgets and deep links",
  ],
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

type SprintPlan = RawSprint & { start: Date; end: Date; limit: Date }

function buildSprints(team: TeamDef): SprintPlan[] {
  return Array.from({ length: SPRINT_COUNT }, (_, i) => {
    const state: SprintState = i < ACTIVE_INDEX ? "closed" : i === ACTIVE_INDEX ? "active" : "future"
    const start = new Date(ACTIVE_START.getTime() + (i - ACTIVE_INDEX) * 14 * DAY)
    const end = new Date(start.getTime() + 11 * DAY + 8 * HOUR) // Friday 17:00
    const complete = state === "closed" ? new Date(end.getTime() - 30 * 60_000) : null
    return {
      id: team.sprintBase + i,
      // "PLAT 26.4.4" = PI 26.4, sprint 4 of 5.
      name: `${team.projectKey} ${PIS[Math.floor(i / SPRINTS_PER_PI)].name.replace(/^PI /, "")}.${(i % SPRINTS_PER_PI) + 1}`,
      teamId: team.id,
      state,
      goal: SPRINT_GOALS[team.id][i],
      startDate: iso(start),
      endDate: iso(end),
      completeDate: complete ? iso(complete) : null,
      piId: PIS[Math.floor(i / SPRINTS_PER_PI)].id,
      start,
      end,
      limit: state === "active" ? GENERATED_AT : (complete ?? end),
    }
  })
}

/** Workflow path ending at `target`, with occasional realistic detours. */
function pathTo(target: string, type: IssueType): string[] {
  if (target === "To Do") return []
  if (target === "Blocked") return chance(0.3) ? ["In Progress", "In Review", "In Progress", "Blocked"] : ["In Progress", "Blocked"]
  const usesQa = type === "Story" || type === "Bug"
  const full: string[] = ["In Progress"]
  if (chance(0.12)) full.push("Blocked", "In Progress")
  full.push("In Review")
  if (chance(0.15)) full.push("In Progress", "In Review")
  if (usesQa) {
    full.push("QA")
    if (chance(0.1)) full.push("In Progress", "In Review", "QA")
  }
  full.push("Done")
  const target2 = !usesQa && target === "QA" ? "In Review" : target
  return full.slice(0, full.lastIndexOf(target2) + 1)
}

/** Spread `statuses` across [from, to] in working time; returns timestamps. */
function schedule(count: number, from: Date, to: Date, endFraction: number): Date[] {
  if (count === 0) return []
  const available = workingHoursBetween(from, to)
  const span = Math.max(0.5, available * endFraction)
  const weights = Array.from({ length: count }, () => between(0.4, 1.6))
  const total = weights.reduce((s, w) => s + w, 0)
  const out: Date[] = []
  let acc = 0
  let prev = from.getTime()
  for (const w of weights) {
    acc += w
    let t = addWorkingHours(from, (acc / total) * span).getTime()
    t = Math.max(t, prev + int(5, 40) * 60_000)
    t = Math.min(t, to.getTime() - 60_000)
    out.push(new Date(t))
    prev = t
  }
  return out
}

const ACTIVE_STATUS_MIX = [
  ["Done", 35],
  ["In Progress", 30],
  ["In Review", 10],
  ["Blocked", 8],
  ["QA", 5],
  ["To Do", 12],
] as const

const TYPE_MIX = [
  ["Story", 50],
  ["Task", 25],
  ["Bug", 20],
  ["Spike", 5],
] as const

const POINTS_MIX = [
  [1, 10],
  [2, 20],
  [3, 25],
  [5, 25],
  [8, 15],
  [13, 5],
] as const

function priorityFor(type: IssueType): string {
  return type === "Bug"
    ? weighted([["Highest", 15], ["High", 40], ["Medium", 35], ["Low", 10]] as const)
    : weighted([["Highest", 5], ["High", 22], ["Medium", 48], ["Low", 17], ["Lowest", 8]] as const)
}

function descriptionFor(type: IssueType, summary: string): string | null {
  if (chance(0.2)) return null
  switch (type) {
    case "Bug":
      return `Steps to reproduce:\n1. ${pick(["Sign in as a standard user", "Open the affected screen", "Trigger the flow from a fresh session"])}\n2. ${pick(["Repeat the action quickly", "Switch accounts mid-flow", "Leave the app idle for 10 minutes"])}\n\nExpected: works normally.\nActual: ${summary.toLowerCase()}.`
    case "Spike":
      return `Timeboxed to 3 days. Outcome: a short write-up with a recommendation and rough estimate.\n\nQuestion: ${summary}?`
    case "Task":
      return `${summary}. No user-facing change expected; coordinate with on-call before rolling out.`
    default:
      return `${summary}.\n\nAcceptance criteria:\n- Behaviour covered by tests\n- Metrics and logging in place\n- Docs / changelog updated`
  }
}

type Draft = Omit<RawIssue, "key" | "id"> & { createdAt: Date }

/** The PI's sprints, first to last. */
function piSprints(plans: SprintPlan[], piIndex: number): SprintPlan[] {
  return plans.slice(piIndex * SPRINTS_PER_PI, (piIndex + 1) * SPRINTS_PER_PI)
}

/** Epics: in progress from their PI's start, done at its end if the PI is over. No sprints. */
function generateEpics(team: TeamDef, plans: SprintPlan[]): RawIssue[] {
  return team.epics.flatMap((epics, piIndex) => {
    const sprints = piSprints(plans, piIndex)
    const piStart = sprints[0].start
    const piEnd = sprints.at(-1)!.end
    const finished = piEnd < GENERATED_AT
    return epics.map(([key, name]): RawIssue => {
      const created = workTimeBefore(piStart, between(7, 14))
      const owner = team.memberIds[0]
      const changelog: RawChange[] = [
        { at: iso(addWorkingHours(piStart, between(0.5, 4))), authorId: owner, field: "status", from: "To Do", to: "In Progress" },
        ...(finished
          ? [{ at: iso(atHour(piEnd, 16)), authorId: owner, field: "status", from: "In Progress", to: "Done" }]
          : []),
      ]
      return {
        key,
        id: key.replace(/\D/g, ""),
        summary: name,
        description: `PI ${PIS[piIndex].name.split(" ")[1]} epic: ${name}.`,
        type: "Epic",
        status: finished ? "Done" : "In Progress",
        statusCategory: finished ? "done" : "in_progress",
        priority: "High",
        assigneeId: owner,
        reporterId: owner,
        teamId: team.id,
        sprintIds: [],
        storyPoints: null,
        labels: [],
        epicKey: null,
        parentKey: null,
        created: iso(created),
        updated: changelog.at(-1)!.at,
        resolved: finished ? changelog.at(-1)!.at : null,
        dueDate: iso(atHour(piEnd, 17)),
        changelog,
      }
    })
  })
}

function generateTeamIssues(team: TeamDef, sprints: SprintPlan[]): Draft[] {
  const pools = Object.fromEntries(
    Object.entries(team.summaries).map(([k, v]) => [k, [...v]]),
  ) as TeamDef["summaries"]
  const used = new Map<string, number>()
  const summaryFor = (type: IssueType) => {
    const pool = pools[type]
    if (pool.length > 0) return pool.splice(Math.floor(rand() * pool.length), 1)[0]
    const base = pick(team.summaries[type])
    const n = (used.get(base) ?? 1) + 1
    used.set(base, n)
    return `${base} (part ${n})`
  }

  const drafts: Draft[] = []

  const make = (sprint: SprintPlan, opts: { midSprint?: boolean; target: string; carryInto?: SprintPlan; carryTarget?: string }) => {
    const type = weighted(TYPE_MIX)
    const summary = summaryFor(type)
    const createdAt = opts.midSprint
      ? addWorkingHours(sprint.start, between(2, Math.max(3, workingHoursBetween(sprint.start, sprint.limit) * 0.7)))
      : sprint.state === "future"
        ? // Leave room for the assignment that follows creation (≤ 90 min).
          new Date(Math.min(workTimeBefore(GENERATED_AT, between(1, 12)).getTime(), GENERATED_AT.getTime() - 2 * HOUR))
        : workTimeBefore(sprint.start, between(1, 21))

    const finalTarget = opts.carryInto ? opts.carryTarget! : opts.target
    const path = pathTo(finalTarget, type)
    const unassigned = finalTarget === "To Do" ? chance(0.5) : chance(0.015)
    const assigneeId = unassigned ? null : pick(team.memberIds)
    const reporterId = pick(team.memberIds)
    const otherMember = () => pick(team.memberIds.filter((m) => m !== assigneeId))
    const authorFor = (status: string) =>
      status === "Done" || status === "QA" ? (chance(0.6) ? otherMember() : assigneeId) : chance(0.85) ? assigneeId : otherMember()

    let storyPoints: number | null = chance(0.1) ? null : weighted(POINTS_MIX)
    const changelog: RawChange[] = []

    // Status changes: split across one or two sprints for carry-overs.
    const startFrom = new Date(Math.max(createdAt.getTime(), sprint.start.getTime()) + 15 * 60_000)
    let times: Date[]
    if (opts.carryInto) {
      const cut = Math.min(path.length, int(1, Math.max(1, path.length - 1)))
      const first = schedule(cut, startFrom, sprint.limit, between(0.3, 0.95))
      const nextStart = new Date(opts.carryInto.start.getTime() + 30 * 60_000)
      const second = schedule(path.length - cut, nextStart, opts.carryInto.limit, path.at(-1) === "Done" ? between(0.2, 0.9) : between(0.1, 0.95))
      times = [...first, ...second]
      const at = iso(new Date(opts.carryInto.start.getTime() + 5 * 60_000))
      changelog.push({ at, authorId: reporterId, field: "sprint", from: String(sprint.id), to: String(opts.carryInto.id) })
    } else {
      const frac = finalTarget === "Done" ? between(0.12, 0.97) : between(0.08, 0.98)
      times = schedule(path.length, startFrom, sprint.limit, frac)
    }

    let prev = "To Do"
    path.forEach((status, i) => {
      changelog.push({ at: iso(times[i]), authorId: authorFor(status), field: "status", from: prev, to: status })
      prev = status
    })

    // Assignment: shortly after creation (or just before work starts).
    if (assigneeId) {
      const firstMove = times[0]?.getTime() ?? Infinity
      const assignedAt = new Date(Math.min(createdAt.getTime() + int(2, 90) * 60_000, firstMove - 60_000))
      changelog.push({ at: iso(assignedAt), authorId: reporterId, field: "assignee", from: null, to: assigneeId })
      // Occasional hand-over mid-flight.
      if (path.length >= 2 && chance(0.08)) {
        const newAssignee = otherMember()
        const at = new Date((times[0].getTime() + times[1].getTime()) / 2)
        changelog.push({ at: iso(at), authorId: newAssignee, field: "assignee", from: assigneeId, to: newAssignee })
      }
    }

    // Occasional re-estimate before the work finished.
    if (storyPoints !== null && times.length >= 2 && chance(0.06)) {
      const before = storyPoints
      storyPoints = pick(POINTS_MIX.map(([p]) => p).filter((p) => p !== before))
      const at = new Date((times[0].getTime() + times[1].getTime()) / 2 + 7 * 60_000)
      changelog.push({ at: iso(at), authorId: assigneeId, field: "storyPoints", from: String(before), to: String(storyPoints) })
    }

    // Occasional priority bump.
    let priority = priorityFor(type)
    if (chance(0.05) && priority !== "Highest") {
      const at = addWorkingHours(createdAt, between(1, 20))
      if (at < GENERATED_AT) {
        changelog.push({ at: iso(at), authorId: reporterId, field: "priority", from: priority, to: "Highest" })
        priority = "Highest"
      }
    }

    changelog.sort((a, b) => a.at.localeCompare(b.at))
    // The final assignee is whoever the last assignee change points at.
    const finalAssignee = changelog.filter((c) => c.field === "assignee").at(-1)?.to ?? assigneeId
    const doneAt = path.at(-1) === "Done" ? iso(times.at(-1)!) : null
    const status = path.at(-1) ?? "To Do"
    const sprintIds = opts.carryInto ? [sprint.id, opts.carryInto.id] : [sprint.id]

    drafts.push({
      createdAt,
      summary,
      description: descriptionFor(type, summary),
      type,
      status,
      statusCategory: CATEGORY[status],
      priority,
      assigneeId: finalAssignee,
      reporterId,
      teamId: team.id,
      sprintIds,
      storyPoints,
      labels: Array.from(new Set([pick(team.labels), ...(chance(0.4) ? [pick(team.labels)] : [])])),
      epicKey: type === "Spike" || chance(0.25) ? null : pick(team.epics[Math.floor(sprints.indexOf(sprint) / SPRINTS_PER_PI)])[0],
      parentKey: null,
      created: iso(createdAt),
      updated: changelog.at(-1)?.at ?? iso(createdAt),
      resolved: doneAt,
      dueDate: type === "Bug" && chance(0.3) ? iso(atHour(sprint.end, 17)) : null,
      changelog,
    })
  }

  const active = sprints[ACTIVE_INDEX]
  const future = sprints[ACTIVE_INDEX + 1]

  // Closed sprints: ~85% done, the rest carried into the next sprint (finished
  // there, or left in any started status when the next one is the active sprint).
  // The previous PI is a little lighter to keep the file small.
  sprints.slice(0, ACTIVE_INDEX).forEach((sprint, k) => {
    const next = sprints[k + 1]
    const count = k < SPRINTS_PER_PI ? int(12, 14) : int(16, 17)
    for (let i = 0; i < count; i++) {
      if (!chance(0.15)) make(sprint, { target: "Done", midSprint: chance(0.05) })
      else if (next === active)
        make(sprint, { target: "Done", carryInto: active, carryTarget: weighted(ACTIVE_STATUS_MIX.filter(([s]) => s !== "To Do")) })
      else make(sprint, { target: "Done", carryInto: next, carryTarget: "Done" })
    }
  })
  // Active sprint: a mix of every status.
  for (let i = 0; i < 22; i++) {
    make(active, { target: weighted(ACTIVE_STATUS_MIX), midSprint: chance(0.07) })
  }
  // Future sprint: a few planned tickets.
  for (let i = 0; i < 5; i++) make(future, { target: "To Do" })

  return drafts
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const sprints: RawSprint[] = []
  const issues: RawIssue[] = []
  let nextId = 10_001
  let plans: SprintPlan[] = []

  for (const team of TEAMS) {
    plans = buildSprints(team)
    sprints.push(...plans.map(({ start: _s, end: _e, limit: _l, ...s }) => s))
    issues.push(...generateEpics(team, plans))
    const drafts = generateTeamIssues(team, plans).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    drafts.forEach(({ createdAt: _c, ...d }, i) => {
      issues.push({ key: `${team.projectKey}-${team.firstKey + i}`, id: String(nextId++), ...d })
    })
  }

  // Every team shares the same sprint calendar, so any team's plans give the PI dates.
  const programIncrements = PIS.map((pi, i) => {
    const s = piSprints(plans, i)
    return { id: pi.id, name: pi.name, startDate: iso(s[0].start), endDate: iso(s.at(-1)!.end), objectives: pi.objectives }
  })

  const output = {
    meta: {
      source: "jira-trawler",
      version: "1.0",
      generatedAt: iso(GENERATED_AT),
      jiraBaseUrl: "https://example.atlassian.net",
      query: { teamIds: TEAMS.map((t) => t.id), sprintIds: sprints.map((s) => s.id) },
    },
    teams: TEAMS.map((t) => ({ id: t.id, name: t.name, projectKey: t.projectKey, memberIds: t.memberIds })),
    people: PEOPLE.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      email: `${p.displayName.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(/ /g, ".")}@example.com`,
      avatarUrl: null,
    })),
    programIncrements,
    sprints,
    issues,
  }

  const here = dirname(fileURLToPath(import.meta.url))
  const outPath = resolve(here, "../src/data/jira-export.json")
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n")
  printSummary(output.issues, sprints, outPath)
}

function printSummary(issues: RawIssue[], sprints: RawSprint[], outPath: string) {
  const count = (keys: string[]) =>
    keys.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {})
  console.log(`Wrote ${issues.length} issues → ${outPath}\n`)
  console.log("Per team:", count(issues.map((i) => i.teamId)))
  console.log("Per type:", count(issues.map((i) => i.type)))
  console.log("Per status:", count(issues.map((i) => i.status)))
  console.log("Unassigned:", issues.filter((i) => !i.assigneeId).length)
  console.log("Carry-overs:", issues.filter((i) => i.sprintIds.length > 1).length)
  console.log("\nPer sprint (issues · statuses):")
  const byDate = [...sprints].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.teamId.localeCompare(b.teamId))
  for (const s of byDate) {
    const inSprint = issues.filter((i) => i.sprintIds.at(-1) === s.id || i.sprintIds.includes(s.id))
    console.log(`  ${s.name.padEnd(16)} ${s.state.padEnd(7)} ${String(inSprint.length).padStart(3)} ·`, count(inSprint.map((i) => i.status)))
  }
}

main()
