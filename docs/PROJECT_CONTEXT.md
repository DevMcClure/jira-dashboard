# Jira Dashboard (Sprint Atlas): project context

> Snapshot of the app as of **26 Oct 2026**: `main` at `3280b38` (PR #1, the PI work) plus **F0 Groundwork** (branch `f0-groundwork`) **F1 Objectives** (branch `f1-objectives`, on top of F0) and **F2 Flow metrics** (branch `f2-flow`, on top of F1). Paste this into a planning chat so it knows what already exists. Whoever reads it has no access to the code, so this file is the source of truth for the current state. The current iteration's plan is `docs/plan-frontend.md`.

## 1. What it is

- A **proof-of-concept Jira sprint and PI dashboard**, built for one owner (a developer) and their teams.
- It reads a **JSON export of Jira data** produced by a separate Python script, the **Jira Trawler**, and visualises it.
  - It shows ticket counts, remaining work, status, assignees, sprint progress and health, PI progress, and ticket movement history.
- **No backend, no API calls, no auth, no secrets.** Everything runs in the browser.
  - Data comes from a mock file, `public/sample/jira-export.json`, fetched at startup (not bundled). Users can also upload a new export on the Import page.
  - Uploads are remembered in `localStorage`.
- It is deployed as a static site to **GitHub Pages** on every push to `main`: https://devmcclure.github.io/jira-dashboard/.
  - Anything bundled is public, so real company data must only ever be uploaded, never committed.
- **"Now" is the export's `generatedAt`, not the real clock.** A snapshot always reads as it did when it was taken.
  - The mock data's "now" is **Mon 19 Oct 2026, 17:00 UTC**.

## 2. Tech stack

| Concern | Choice |
|---|---|
| Build | Vite 8, React 19, TypeScript 7 (strict) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Components | shadcn/ui (new-york style, neutral base, CSS variables) |
| Charts | shadcn `chart` (Recharts 3) |
| Tables | shadcn `table` + TanStack Table |
| Icons / routing / validation / dates | lucide-react, react-router-dom 7, zod 4, date-fns 4 |
| Markdown preview | react-markdown + remark-gfm (Export page only) |
| Tests / lint | Vitest (96 tests), oxlint |
| Package manager | pnpm (scripts are also run as `npm run …`) |

Commands: `dev`, `build` (type-check + build), `test`, `lint`, `mock:data` (regenerates the mock JSON).

## 3. Project rules (from CLAUDE.md, still in force)

- Use shadcn components wherever one exists; don't hand-roll buttons, cards, tables and so on.
- **Theme only through CSS variables.** Components never contain hex colours. Status and chart colours are tokens in `src/index.css`.
- **Dark mode is the default**, with a working light/dark toggle.
- **All data access goes through `src/lib/jira/`.** The flow is raw JSON → `adapter.ts` → typed domain model → hooks. To support a new export format, only the adapter, schema and trawler mapping change.
- **Every derived number is computed in pure, unit-tested functions** in `src/lib/jira/metrics.ts`. Components only display.
- Small components, one per file. It's a POC, so polish beats breadth. **Don't add features outside the agreed plan without asking.**
- Definition of done:
  - build, test and lint pass with zero errors
  - pages render in dark and light mode at 1440px and 1024px
  - an invalid upload shows a toast and keeps the old data
  - the README is current

## 4. Layout and navigation

**Shell.** A collapsible shadcn sidebar holds:
- an app switcher ("Jira Dashboard"), whose menu offers "Import a JSON export…" and "Reset to sample data"
- a "Data: sample · generated 19 Oct 2026" line
- two nav groups
- a static user row ("User", avatar "U")

**Header**, left to right:
- sidebar toggle and breadcrumb
- **Scope picker**: "Current sprint" or one PI; hidden when the export has no PIs
- **Time period**: Today, Yesterday, Last 7 days, Last 14 days, Current sprint, This PI (only when PIs exist), All time
- **Filters**: Sprints, Teams and Assignees multi-select popovers ("All" when empty)
- theme toggle
- "D" logo mark

**Explore the Sprints**
| Page | Route | What it shows |
|---|---|---|
| Overview | `/` | One card per team: tickets, remaining points, average velocity, activity in the period (moves, created, done, blocked), velocity chart, members with workload. Click a card to open the team page. |
| PI | `/pi` | The PI in scope (or the current PI in sprint scope). Tiles: % of points done vs % of time gone, points, tickets, days left; objectives; **PI burnup** (done vs scope, sprint boundaries, "Today" line); **sprint calendar** (row per team, column per sprint, health per cell, click → tickets); a card per team (PI health + velocity); **epics table** (progress per epic, least done first). |
| Objectives | `/objectives` | The PI in scope's objectives. Tiles: committed objectives on track / at risk / off track, the uncommitted count, and **predictability** (Σ actual ÷ Σ planned business value of committed objectives, closed PIs only). A card per team, then **ART level**. Each row shows the title, a Committed or Uncommitted badge, BV planned / actual, progress with a "time gone" marker, health and forecast. A row expands to its epics and tickets; "Burnup" opens a side sheet with the objective's burnup. Team filters hide other teams' objectives; ART objectives always show. |
| Details | `/details` | KPI row (total, in progress, blocked, in review, each with a delta and a 14-day sparkline), sprint burndown with a sprint picker, status donut, recent movements, sprint health list, tickets by assignee. |
| Team detail | `/teams/:id` | The Details view for one team, plus velocity and members. |
| Health | `/health` | Counts by health level, active-sprint cards worst first, closed-sprint table, and a PI health line when a PI is selected. |
| Tickets | `/tickets`, `/tickets/:key` | Data table with search, faceted filters, column visibility, sort and pagination. A row opens a side sheet with ticket details and a timeline of status and assignee changes, with time spent in each status. |
| Sprints | `/sprints` | Sprint cards grouped by active, future and closed: progress, scope change, status counts. Click one to filter Tickets to it. |
| People | `/people` | Workload per assignee, including Unassigned, sorted by open points. |
| Flow | `/flow` | The six SAFe flow metrics, in **items and time, not points**. A working hours / calendar time toggle; every chart says which it uses. KPI row (velocity, flow time p85, load, efficiency, distribution, predictability), then: **aging WIP** (open items by status and age against cycle-time percentile lines; click a dot to open the ticket), throughput per week, cycle-time scatter with p50/p85/p95, WIP over time (active vs waiting), efficiency trend, "where the time goes" by status, distribution per sprint by flow type, predictability per PI with an 80–100% band. Charts cover at least the last 8 weeks. The ticket sheet gains a Flow block. |
| Movements | `/movements` | Cumulative flow diagram, created vs resolved, transitions per day (by hour for single-day periods), and a full transitions table. |

**About the Data**
| Page | Route | What it shows |
|---|---|---|
| Import | `/import` | Drag-and-drop upload (JSON, or a Trawler audit `.log`), summary of the loaded data, readable validation errors, Reset / Download current data, collapsible "Expected format". |
| Export | `/export` | Builds a **Markdown report**. Options: scope (Current sprint / Whole PI), teams, sprints, time period, and section tick-boxes (Summary, Program increment, Teams, Sprints, Status breakdown, People, Movements). Live preview with **Preview** (rendered) and **Markdown** (raw) tabs; Copy and Download `.md`. Starts from the header's settings without changing them. |
| About | `/about` | What the app is, plus counts for the loaded data. |

## 5. Scope, filters and periods (how numbers are chosen)

- **Scope** (header):
  - *Current sprint* (the default): ticket-level views cover each team's **active sprint**. A team with no active sprint falls back to its latest closed one.
    - History views (sprint health, burndown picker, Sprints page, velocity) cover all sprints of **the PI containing the active sprint**.
  - *A PI*: everything covers all of that PI's sprints.
  - Changing scope clears picked sprints.
- **Filters**: picking sprints in the header filter **replaces** the scope's sprints. Teams and assignees narrow everything further. The team detail page forces its own team.
- **Period** drives every activity number: deltas, movements, created/resolved, "this period" lines.
  - Rolling periods end at "now"; Yesterday is the whole previous calendar day.
  - Today and Yesterday are charted by hour, everything else by day.
- **Health rule** (sprints and PIs): compare % of points done with % of time elapsed. More than 15 points behind is **at risk**, more than 30 behind is **off track**, and closed means **completed**.

## 6. Data model (the JSON contract)

Top-level keys:
- `meta`: `source`, `version`, `generatedAt`, `jiraBaseUrl`, `query`
- `teams`: `id`, `name`, `projectKey`, `memberIds`
- `people`: `id`, `displayName`, `email?`, `avatarUrl?`
- `sprints`: `id`, `name`, `teamId`, `state` (future / active / closed), `goal`, `startDate`, `endDate`, `completeDate`, **`piId?`**
- **`programIncrements?`**: `id`, `name`, `startDate`, `endDate`, `state?`, `objectives?[]`
  - each objective is `{ id, title, teamId? (null = ART level), description?, ownerId?, committed? (default true), plannedBusinessValue?, actualBusinessValue? (0–10), epicKeys?[], issueKeys?[] }`
  - plain strings (older exports) still load as ART-level committed objectives with no links
- `issues`:
  - identity and text: `key`, `summary`, `description`, `type` (Story / Bug / Task / Sub-task / Epic / Spike), `labels`
  - status: `status`, `statusCategory` (todo / in_progress / done)
  - people and grouping: `priority`, `assigneeId`, `reporterId`, `teamId`, `sprintIds[]` (more than one means it was carried over)
  - planning: `storyPoints`, `epicKey`, `parentKey`
  - dates: `created`, `updated`, `resolved`, `dueDate`
  - `changelog[]`: `{ at, authorId, field: status|assignee|sprint|storyPoints|priority, from, to }`

Key behaviour:
- **Validation**: zod validates every load. Required fields are strict, everything else is lenient, and unknown fields are ignored.
  - Unknown statuses are coloured by their category.
  - A missing person becomes "Unknown (id)".
- **Workflow**: To Do → In Progress → In Review → (Blocked) → QA → Done. Each status has a colour token.
- **Metrics replay changelogs** to know each ticket's status and points at any moment. Burndown, burnup, velocity, cumulative flow and health are all time-accurate.
- **PIs**:
  - A PI is ~10 weeks: **5 two-week sprints, same dates for every team**.
  - A sprint's PI is its `piId`, else the PI whose dates contain its start.
  - Without `programIncrements` the app behaves as a plain sprint dashboard: no scope picker, and the PI page shows an empty state.
- **Epics stand in for PI features.** They are issues of type `Epic` with no sprints, linked from stories through `epicKey`.

## 7. The real Jira Trawler (current limits)

- Today's Trawler runs with `sprint_open: true`, so it **only pulls the current sprint**.
- Its raw output uses Jira's own field names: `{ projects, tickets }`, or an audit log with `PROJECT {…}` / `TICKET {…}` lines. `src/lib/jira/trawler.ts` detects and converts it automatically:
  - each project becomes a team
  - people come from assignee, reporter and creator
  - story points are read from several field spellings
  - Jira's native `changelog.histories[].items[]` becomes the changelog
- It has **no sprint dates**, so each project gets one synthetic active sprint with unknown dates. As a result burndown and velocity are empty, and health can't compare against time.
- **Planned:** the Trawler will be expanded to pull a whole PI. The dashboard is ready for the contract shape.
  - A top-level `programIncrements` is passed through today.
  - The real field mapping still has to be written once the expanded Trawler's output is known.

## 8. Mock data (`public/sample/jira-export.json`, seeded and deterministic)

- **3 teams**: Platform (PLAT, 5 people), Web (WEB, 6), Mobile (MOB, 4); 14 people in total.
- **2 PIs**, shared by all teams, 5 sprints each per team:
  - **PI 26.3**: 22 Jun – 28 Aug 2026, all closed.
  - **PI 26.4**: 31 Aug – 6 Nov 2026. Sprints .1–.3 are closed, **.4 is active** (12–23 Oct, ~60% elapsed at "now"), and .5 is future.
- **Sprint names** follow `{team} {PI}.{n}`, e.g. **"PLAT 26.4.4"** = PI 26.4, sprint 4. That's 30 sprints in total.
- **445 tickets**, including **24 epics** (4 per team per PI). About 40% of Tasks are labelled `tech-debt` and 40% of Spikes `risk`, so every flow type appears.
- **Objectives**: 3–4 per team per PI plus 3 ART-level ones per PI (15 in PI 26.3, 13 in PI 26.4). About 1 in 4 is uncommitted, and each links 1–3 epics. PI 26.3 has actual business values, giving **81% predictability** (71 of 88 planned business value).
- Realistic summaries per domain: billing, auth and webhooks; onboarding, accessibility and search; push notifications, offline mode and widgets.
- Each closed sprint finishes ~85% of its work and carries the rest over into the next sprint, sometimes across the PI boundary.
- The active sprint has every status mix.
- Status moves happen only on weekdays, 09:00–18:00.

## 9. Code map (for reference)

- `src/lib/jira/flow.ts`, `flowConfig.ts`, `working-time.ts`: flow metrics, their settings (status → active / waiting, type → Feature / Defect / Risk / Debt / Other, working hours Mon–Fri 09–18 Europe/London), and timezone-aware working-time maths.
- `src/lib/data/`: the **`DataSource`** interface (`load`, `loadFile`, `reset`) and `createStaticDataSource` (sample fetch + uploads remembered in `localStorage`). `DataProvider` only talks to this, so a server-backed source can replace it later.
- `src/lib/reports/`: the **`ReportStore`** interface (`list`, `get`, `save`, `remove`, generic over the config) and `createLocalReportStore` on `localStorage`. Not used by any page yet; F3 (Report mode) wires it up.

- `src/lib/jira/`: `schema.ts` (zod), `types.ts`, `adapter.ts` (`parseExport`), `trawler.ts` (raw Trawler → contract), `metrics.ts` (all calculations), `period.ts`, `scope.ts` (resolves the current-sprint / PI scope), `report.ts` (Markdown report), plus tests and fixtures.
- `src/context/DataProvider.tsx`: loads through a `DataSource` (full-screen skeleton until ready, error card with Retry / Import if the sample can't be fetched), plus upload/reset, filters, period, scope, burndown sprint.
- `src/hooks/`: `useFilteredIssues` / `useHistoryIssues`, `useScopedSprints` / `useHistorySprints`, `useScope`, `usePeriod`, …
- `src/pages/` (one per route) and `src/components/{layout,dashboard,filters,pi,health,tickets,movements,teams,people,sprints,import,export,theme,ui}`.
- `scripts/generate-mock-data.ts`: the mock generator.
- `docs/`: `plan-frontend.md` (the current iteration plan), `decisions/` (one record per decision), and this file.

## 10. Known gaps and loose ends

- **The PI page, scope switch and Export page haven't been checked visually** in a browser across both themes and widths. Tests and builds pass.
- ~~Bundle size~~: fixed in F0. The sample is fetched, and the entry chunk is ~570 kB with no warning.
- **Real Trawler output** gives no sprint dates or PIs yet, so the time-based charts stay empty with real data until the Trawler is expanded.
- PI "done" uses each ticket's current status, not a replay at the PI's end. That's fine for active PIs, but approximate for a closed PI whose tickets were reopened later.
- Epic names come from Epic issues in the export. If those aren't exported, only keys are shown.
- The time period offers presets only; there's no custom date range.
- Objective forecasts skip weekends but not holidays (decision 0012).
- The mock data's flow efficiency is ~60%. Real teams usually read well under 50%; the generator moves tickets only in working hours and has short review queues.
- Flow settings (`flowConfig.ts`) are code, not a settings page, until the backend iteration.
- No PI-over-PI comparison view yet, although the mock data has a closed previous PI to support one.
- No IP (Innovation & Planning) sprint concept; all 5 sprints are treated the same.
- `CLAUDE.md` (local, git-ignored) now says pnpm and oxlint, and lists the rules for the new seams (fixed in F0).
- `README.md` embeds `docs/screenshot-overview.png`, which has been deleted locally, so the image is broken until it's restored or replaced.

## 11. Feature history (newest first)

1. **F2 Flow metrics**: `/flow` page with the six SAFe flow metrics, working-hours / calendar toggle, aging WIP, a Flow block in the ticket sheet, a Flow section in Export, timezone-aware working time, and validated flow-type colours.
2. **F1 Objectives**: objective contract (lenient about plain strings), progress / health / forecast / predictability metrics, `/objectives` page with expandable rows and a burnup sheet, a "View all" link on the PI page's card, and an Objectives section in Export. The mock data has 4 epics and 3–4 objectives per team per PI.
3. **F0 Groundwork**: sample data fetched from `public/` instead of bundled; `DataSource` and `ReportStore` interfaces with browser implementations; `docs/decisions/`; CLAUDE.md updated.
4. Mock data made more realistic: PI-style sprint names; the PI page counts sprints per team.
5. **PI scope** (PR #1): data contract, scope picker, PI page, "This PI" period, PI report section, two-PI mock data.
6. "Guest" renamed "User"; logo mark "D"; "Yesterday" period added.
7. Rendered Markdown preview on Export.
8. Export page (Markdown report with scope, period and section choices).
9. Data model aligned with the real Trawler output (raw JSON and audit log import).
10. Drag-and-drop fix; Overview turned into team cards; Details page; Health page; team detail pages.
11. GitHub Pages deploy; original POC build (shell, overview, tickets, sprints, people, movements, import, polish).
