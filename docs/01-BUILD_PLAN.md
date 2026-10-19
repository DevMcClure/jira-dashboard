# 01 — Build Plan

Work through these phases **in order**. After each phase: run `npm run build` and `npm run lint`, fix anything broken, then commit with the message shown. Don't start the next phase with a failing build.

---

## Phase 0 — Scaffold
1. Create the project in the current folder:
   ```bash
   npm create vite@latest . -- --template react-ts
   npm install
   ```
2. Install Tailwind v4 and wire it up with `@tailwindcss/vite` in `vite.config.ts`. Add the `@/*` → `./src/*` path alias in `vite.config.ts`, `tsconfig.json` and `tsconfig.app.json` (required by shadcn).
3. Initialise shadcn:
   ```bash
   npx shadcn@latest init
   ```
   Choose: style `new-york`, base colour `neutral`, CSS variables `yes`.
4. Add the shadcn components needed for the whole build up front:
   ```bash
   npx shadcn@latest add sidebar breadcrumb separator button card badge table chart \
     dropdown-menu avatar tooltip select input tabs sheet skeleton sonner progress \
     scroll-area toggle-group popover command calendar hover-card
   ```
5. Install the rest:
   ```bash
   npm install react-router-dom @tanstack/react-table zod date-fns lucide-react
   npm install -D vitest @vitest/coverage-v8 tsx
   ```
6. Add scripts to `package.json`: `test` (`vitest run`), `test:watch`, `mock:data` (`tsx scripts/generate-mock-data.ts`).
7. Copy the provided `.gitignore` into the repo root (already supplied — don't overwrite it).
8. `git init` if needed. Commit: `chore: scaffold vite + react + tailwind + shadcn`.

## Phase 1 — Data layer
Follow `02-DATA_CONTRACT.md` exactly.
1. `src/lib/jira/schema.ts` — zod schemas for the export file.
2. `src/lib/jira/types.ts` — domain types (inferred from zod where possible).
3. `src/lib/jira/adapter.ts` — `parseExport(raw: unknown): JiraDataset` (validate with zod, normalise dates to `Date`, sort changelogs, build lookup maps).
4. `scripts/generate-mock-data.ts` — deterministic (seeded) mock generator. Run it to produce `src/data/jira-export.json`.
5. `src/lib/jira/metrics.ts` — pure functions (see "Metrics" in the data contract).
6. `src/lib/jira/metrics.test.ts` — tests for every metric with a tiny hand-built fixture.
7. `src/context/DataProvider.tsx` — React context holding the current `JiraDataset`, plus:
   - initial load from the bundled `jira-export.json`
   - `loadFromFile(file: File)` → parse → on success replace data + toast "Loaded N tickets from <filename>"; on failure toast the zod error summary and keep the old data
   - persist the last uploaded file's raw JSON in `localStorage` (wrapped in try/catch) so a refresh keeps it; a "Reset to sample data" action clears it
   - global filters in context: selected sprint IDs, team IDs, assignee IDs (default: all)
8. `src/hooks/useFilteredIssues.ts` — returns issues matching the global filters.

Commit: `feat: jira data contract, adapter, mock data and metrics`.

## Phase 2 — App shell (match the reference app)
Follow `03-UI_SPEC.md` → "Shell".
1. `src/components/layout/AppSidebar.tsx` — shadcn `Sidebar` (`collapsible="icon"`) with header switcher, two nav groups, footer user.
2. `src/components/layout/SiteHeader.tsx` — `SidebarTrigger`, vertical `Separator`, `Breadcrumb` with the current page, right side: global filter bar + theme toggle + logo mark.
3. `src/components/layout/AppLayout.tsx` — `SidebarProvider` + `SidebarInset` + `<Outlet/>`.
4. `src/components/theme/ThemeProvider.tsx` + `ThemeToggle.tsx` — class-based dark mode, default dark, remembered in `localStorage`.
5. Routes in `src/App.tsx`: `/` Overview, `/tickets`, `/tickets/:key` (opens a Sheet over the table), `/sprints`, `/teams`, `/people`, `/movements`, `/import`, `/about`.
6. `src/components/layout/PageHeader.tsx` — title + muted description (used by every page).

Commit: `feat: app shell, sidebar, header, routing, theming`.

## Phase 3 — Overview page (the hero screen)
Layout mirrors the reference "Overview" screen. Details in `03-UI_SPEC.md` → "Overview".
1. KPI row (4 `StatCard`s): Total tickets · Remaining · Completed · Blocked — each with a delta line ("+6 this week").
2. Sprint burndown chart (area chart: ideal vs actual remaining story points) for the selected/active sprint, with a sprint `Select`.
3. Status breakdown (donut/radial chart) + "Tickets by assignee" horizontal bar chart.
4. "Recent movements" table (last 15 status transitions: ticket, from → to badges, who, when relative) — left, wide.
5. "Sprint health" card — right, narrow. Same pattern as the "Service status" list in the reference: coloured dot + sprint name + one-line status ("On track · 62% done, 4 days left" / "At risk" / "Completed").

Commit: `feat: overview dashboard`.

## Phase 4 — Tickets page
1. Data table (TanStack) with columns: Key, Summary, Type (icon), Status (badge), Priority (icon), Assignee (avatar + name), Sprint, Story points, Created, Updated, Age (days).
2. Toolbar: text search, faceted filters (status, type, priority, assignee) using `Popover` + `Command`, column visibility dropdown, "Reset" button.
3. Sorting on every column, pagination (25/page), row count footer.
4. Clicking a row navigates to `/tickets/:key` and opens a right-hand `Sheet` with: header (key, summary, status badge), metadata grid, description, labels, and a **vertical timeline of its changelog** (status changes + assignee changes, with dates and time-in-status).
5. Empty state uses the same centred "No results." style as the reference.

Commit: `feat: tickets data table and ticket detail sheet`.

## Phase 5 — Sprints, Teams, People, Movements
1. **Sprints** — a card per sprint: name, dates, state badge, goal, `Progress` bar (done / committed points), counts by status, scope change (points added after start). Clicking a card sets it as the burndown sprint and filters Tickets.
2. **Teams** — per team: tickets, remaining, velocity across its sprints (bar chart), members list.
3. **People** — per assignee: avatar, open / in progress / done counts, story points, a mini stacked bar. Sort by workload. Include an "Unassigned" row.
4. **Movements** — the full ticket-movement log:
   - chart: transitions per day stacked by destination status
   - "Created vs resolved" line chart per day
   - filterable table of every transition (ticket, from, to, by, at, time spent in previous status)
   - cumulative flow diagram (stacked area of ticket count per status per day) — this is the "impressive" chart, make it look good.

Commit: `feat: sprints, teams, people and movements views`.

## Phase 6 — Import page
1. Drag-and-drop zone (plus "Browse" button) accepting `.json`.
2. On drop: parse via `loadFromFile`, show a summary card (source, generated at, #sprints, #teams, #tickets, #transitions) and any validation errors in a readable list.
3. "Reset to sample data" and "Download current data" buttons.
4. A collapsible "Expected format" section rendering a short example from the data contract in a code block.

Commit: `feat: json import`.

## Phase 7 — Polish & verify
1. Loading skeletons on charts/cards (simulate with a short `Suspense`/state flag on first load only).
2. Check every page in dark and light mode, at 1440px and 1024px; sidebar collapsed and expanded.
3. All charts have tooltips and legends; empty datasets render an empty state, not a broken chart.
4. Keyboard: sidebar toggle `Ctrl/Cmd+B` (shadcn default) works; table rows are focusable.
5. Write `README.md`: what it is, `npm install && npm run dev`, how to regenerate mock data, how to plug in a real Trawler export (edit `adapter.ts` only), screenshot placeholder.
6. Final: `npm run build && npm run test && npm run lint` clean.

Commit: `chore: polish, readme`.

---

## Folder structure (target)
```
.
├─ CLAUDE.md
├─ docs/                     # these planning docs
├─ scripts/generate-mock-data.ts
├─ src/
│  ├─ app/routes …            # or pages/
│  ├─ pages/                  # Overview, Tickets, Sprints, Teams, People, Movements, Import, About
│  ├─ components/
│  │  ├─ layout/              # AppSidebar, SiteHeader, AppLayout, PageHeader
│  │  ├─ dashboard/           # StatCard, BurndownChart, StatusDonut, SprintHealthList, …
│  │  ├─ tickets/             # columns.tsx, DataTable.tsx, Toolbar, TicketSheet, Timeline
│  │  ├─ theme/
│  │  └─ ui/                  # shadcn (generated — don't hand edit unless needed)
│  ├─ context/DataProvider.tsx
│  ├─ hooks/
│  ├─ lib/jira/               # schema, types, adapter, metrics (+ tests)
│  ├─ data/jira-export.json
│  └─ index.css
└─ .gitignore
```