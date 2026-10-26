# Jira Dashboard: Frontend Iteration Plan

Oct 26, 2026 · @Devan

## Summary

This iteration adds Objectives, Flow metrics and a Report mode to the Jira Dashboard, all in the browser on mock data, with no server, no auth and no database. It still deploys to GitHub Pages exactly as today.

Report mode is the new direction, built frontend-first. A Scrum Master saves the current filters as a named report. Anyone who opens its link sees the dashboard already configured that way, behind a banner, with the filters locked. Reports are kept in `localStorage` and shared by link for now. The backend iteration later moves them into MongoDB and adds recipients, sign-in and access control, without changing the screens.

Four phases, one Claude Code session each:

1. **F0 Groundwork**: tidy-ups, plus the interfaces the backend will plug into.
2. **F1 Objectives**: PI objectives with progress rolled up from epics and tickets.
3. **F2 Flow metrics**: a Flow page with the six SAFe flow metrics.
4. **F3 Report mode**: save, open and share a configured dashboard view.

F1 must come before F2, because Flow Predictability uses objectives. F3 is independent and can run in parallel with F1 and F2 after F0.

The companion Backend Iteration Plan covers the server, Crowd auth, the live Trawler feed and MongoDB snapshots.

## Phased plan

### F0: Groundwork

Goal: tidy up, and put in the interfaces the later phases and the backend build on, without changing behaviour.

- Update `CLAUDE.md`: pnpm and oxlint, and the rules for the new interfaces below.
- Load the sample data with `fetch()` from `public/sample/jira-export.json` instead of bundling it. This fixes the 1 MB chunk warning.
- Add a `DataSource` interface behind `DataProvider`, with one implementation, `StaticDataSource` (bundled sample plus upload, which is today's behaviour).
- Add a `ReportStore` interface (`list`, `get`, `save`, `remove`) with a `LocalReportStore` on `localStorage`. F3 uses it.
- Add `docs/decisions/` with one short record per decision in this plan.

Acceptance:

- [x] Build, test and lint are green; all 96 existing tests still pass (114 with F0's new tests)
- [ ] The Pages site looks and behaves exactly as before *(not yet checked in a browser; the sample loads under the `/jira-dashboard/` sub-path in `vite preview`, and the only new UI is a loading skeleton and a load-error card)*
- [x] No chunk-size warning (entry chunk ~1,000 KB → ~570 KB)

### F1: Objectives

Goal: see each PI objective's progress, worked out from its epics and tickets.

- Contract: extend the PI `objectives[]` to:
  - `id`, `piId`, `teamId` (null for an ART-level objective), `title`, `description?`, `ownerId?`
  - `committed` (boolean), `plannedBusinessValue?` and `actualBusinessValue?` (1-10)
  - `epicKeys[]`, plus optional `issueKeys[]`
- The contract stays lenient, so older exports still load.
- Mock data:
  - 3 or 4 objectives per team per PI, about one in four uncommitted
  - each objective linked to 1 or 2 epics
  - PI 26.3 (closed) gets actual business values
- Metrics in `metrics.ts`, all unit-tested:
  - **progress**: done points ÷ total points of the linked epics' stories plus any directly linked issues. Fall back to counts when there are no points.
  - **health**: the existing rule, progress vs % of PI time elapsed.
  - **forecast**: projected % done at PI end, from the done rate over the last 10 working days.
  - **PI predictability**: Σ actual BV ÷ Σ planned BV of committed objectives. Uncommitted objectives add to actual only, so it can go over 100%.
- `/objectives` page, under Explore the Sprints:
  - Tiles: committed objectives on track, at risk and off track; uncommitted count; predictability for closed PIs.
  - Rows grouped by team, then ART level. Each row shows the title, a Committed or Uncommitted badge, BV planned and actual, a progress bar with a "time gone" marker, and a health chip.
  - Each row expands to its linked epics and their tickets.
  - A side sheet shows the objective's burnup.
- The PI page's objectives card links to `/objectives`. Export gains an Objectives section.

Acceptance:

- [x] Both mock PIs show objectives; PI 26.3 shows a predictability % (81% in the current sample: 71 of 88 planned BV)
- [x] Scope, team and sprint filters update the rollups (see decisions 0011 and 0013)
- [x] An export with no objectives shows an empty state, not an error

### F2: Flow metrics

Goal: a Flow page with the six SAFe flow metrics, built from the changelog. See the Flow metrics research section below for the definitions and caveats.

- `flowConfig.ts`:
  - Maps each status to `not-started`, `active`, `waiting` or `done`. Defaults: To Do not-started; In Progress and QA active; In Review and Blocked waiting; Done done.
  - Maps each Jira type to a flow type: Feature, Defect, Risk, Debt or Other.
  - A working-hours setting.
- Functions in `metrics.ts`:
  - `flowVelocity`, `flowTime` (cycle and lead time, 50th, 85th and 95th percentiles), `flowLoad` (daily WIP and work item age)
  - `flowEfficiency`, `flowDistribution`, and `flowPredictability` (reusing F1)
- `/flow` page, top to bottom:
  - KPI row with period deltas
  - aging WIP chart: in-progress tickets by status, one dot per ticket's age, with percentile bands from history
  - throughput per week
  - cycle-time scatterplot with percentile lines
  - WIP over time
  - efficiency trend, plus a "where the time goes" stacked bar by status
  - distribution per sprint
  - predictability per PI
- The ticket side sheet gets a Flow block: cycle time so far, and active vs waiting time.
- Export gains a Flow section.

Acceptance:

- [x] Every flow number has a unit test with a hand-worked fixture (`flow.test.ts`, `working-time.test.ts`, `__fixtures__/flow-export.json`)
- [x] The page respects scope, filters and period like every other page (see decision 0016 for the chart window)
- [x] Each chart states whether it uses working hours or calendar time

**Refined after F2** (26 Oct 2026, from the DX article on flow metrics): the page now leads with Flow Time and Flow Load, adds a "From created / From work started" switch for Flow Time (default created), aligned weekly flow time vs throughput, a WIP vs throughput view, a team table (team level only), size and now-vs-finished mix context, history and sample-size warnings, and a "How these are measured" panel. See decisions 0022–0024.

### F3: Report mode

Goal: save a configured view as a named report. Anyone who opens it sees the dashboard set up exactly that way.

- `ReportConfig`, a zod schema with `schemaVersion: 1`:
  - `scope`, `piId`, `sprintIds`, `teamIds`, `assigneeIds`
  - `period`, plus an optional fixed `from`/`to` for frozen reports
  - `pages` (which pages the report includes) and `landingPage`
  - `title`, `note`, `author` (free text until sign-in exists)
  - `kind`: live or frozen
  - `dataStamp`: the export's `generatedAt` when the report was saved
- Two kinds of report:
  - **Live**: filters are re-applied to whatever data is loaded; the period stays relative, e.g. "last 7 days".
  - **Frozen**: the period is pinned to absolute dates, and the report records which data it was made from. Saving a Markdown export also saves a frozen report.
- Authoring:
  - "Save as report" in the header captures the current filters. A dialog sets title, note, kind and included pages.
  - The Export page gets the same action.
- Reading:
  - A new "My Reports" nav group lists saved reports.
  - Opening one enters report mode at `/reports/:id/<page>`. The normal pages render under the report's config, and only the included pages show in the sidebar.
  - A banner names the report, author, kind and as-of time.
  - Header filters are visible but locked.
  - "Explore from here" copies the config into your own filters and leaves the report unchanged. "Exit report" returns to your previous view.
- Sharing without a server:
  - "Copy link" encodes the config in the URL (`/r?c=<base64url>`), validated with zod on open.
  - Opening a link enters report mode and offers "Save to My Reports".
  - If the loaded data's `generatedAt` differs from the report's `dataStamp`, the banner says so. On Pages with sample data this always matches.
- Implementation: `DataProvider` accepts an optional report context that overrides filters, so pages are reused, not duplicated.

Acceptance:

- [x] Save "WEB 26.4.4 status" (Web team, sprint 26.4.4, last 7 days, Overview + Details + Objectives) *(config round-trip unit-tested; the dialog itself not yet clicked through in a browser)*
- [x] Open its link in a private window: same filters, only those three pages, filters locked *(verified by rendering the `/r/<code>` route with the sample: banner, exactly those three sidebar pages, controls disabled, pages see Web + WEB 26.4.4 + "Last 7 days"; a real private-window check is still to do)*
- [x] "Explore from here" unlocks without changing the saved report
- [x] A tampered or invalid link shows a toast and falls back to the normal dashboard

## Flow metrics research

All six SAFe flow metrics can be computed from data the app already has, because the changelog records every status change with a timestamp. Five of the six come from the Flow Framework; SAFe adds Flow Predictability, which depends on F1.

The key difference from today's dashboard: flow metrics count **items and time**, not story points. They sit beside the points-based velocity and burndown; they don't replace them.

| Metric | What it measures (SAFe) | How we compute it from the export | Shown on /flow as |
| --- | --- | --- | --- |
| Flow Velocity | items finished in a period | tickets that first entered a done-category status within the period; Epics and Sub-tasks excluded by default | bars per week, with period delta |
| Flow Time | time from entering the workflow to done | **cycle time**: first move into an active status → done. **Lead time**: created → done. Report the 50th, 85th and 95th percentiles, not the mean | scatterplot, one dot per finished ticket, with percentile lines |
| Flow Load | work in progress across all steps | tickets in active or waiting statuses at the end of each day (changelog replay), plus **work item age** for each one still open | WIP line over time; aging WIP chart |
| Flow Efficiency | share of elapsed time spent actively worked | time in active statuses ÷ total cycle time, summed over tickets finished in the period (an aggregate, not an average of per-ticket ratios) | trend line, plus a stacked bar of time by status |
| Flow Distribution | mix of work item types | share of finished (and of in-progress) tickets per flow type: Feature, Defect, Risk, Debt | stacked bar per sprint |
| Flow Predictability | planned vs actual business value | Σ actual BV ÷ Σ planned BV of committed PI objectives (F1) | per-PI bars with an 80-100% band |

Flow efficiency, written out:

```latex
\text{Flow efficiency} = \frac{\sum \text{time in active statuses}}{\sum (\text{time in active statuses} + \text{time in waiting statuses})}
```

Decisions and caveats for the build:

- **Status mapping drives efficiency.** Jira records statuses, not whether anyone was working. Tools in this space make you mark which statuses are queues; without that, only Blocked time counts as waiting.
  - Our defaults treat In Review and Blocked as waiting, and In Progress and QA as active.
  - Expect values well under 50%. That is normal, not a bug.
- **Calendar time vs working time.** Counting nights and weekends as waiting makes a review requested on Friday evening look like 60-plus hours of queue.
  - Offer a "working hours only" setting (Mon-Fri, 09:00-18:00, Europe/London) and make it the default.
  - Every chart states which one it uses.
- **Work item age is the daily Scrum Master signal.** Cycle time only describes finished work. Age shows which open tickets are drifting past the team's usual 85th percentile today, so the aging chart goes first on the page.
- **Distribution needs a type mapping.** Story and Epic default to Feature, Bug to Defect. Task and Spike count as Debt or Risk only when labelled `tech-debt` or `risk`; everything else is Other. The mapping is editable in `flowConfig.ts`.
- **Read the aggregate, not single tickets.** Per-ticket efficiency is noisy, so the ticket sheet shows it as context only.
- **Reopened tickets** keep their first start and last done date; the time spent in Done between counts as waiting.
- **Real Trawler data.** Velocity, time, load, efficiency and distribution work with today's Trawler changelog, even without sprint dates. Predictability needs objectives, which the Trawler does not export yet.

Sources: [SAFe: Accelerating Flow with SAFe](https://framework.scaledagile.com/accelerating-flow-with-safe) · [cPrime: SAFe 6.0 flow metrics, part 2](https://www.cprime.com/blog/safe-6-0-deep-dive-flow-metrics-part-2-of-2/) · [ActionableAgile: Flow efficiency chart](https://55degrees.atlassian.net/wiki/x/igErR) · [Metabase: Queue time and flow efficiency](https://www.metabase.com/metrics/queue-time) · [Premier Agile: SAFe flow metrics](https://premieragile.com/complete-details-on-safe-flow-metrics)

## Seams left for the backend

The frontend builds four interfaces now with browser-only implementations. The backend iteration then adds server-backed ones behind the same interfaces, so no page has to change.

| Interface | Frontend iteration | Backend iteration adds |
| --- | --- | --- |
| `DataSource` | `StaticDataSource`: sample file plus upload | `ApiDataSource`: live data from the Trawler feed |
| `ReportStore` | `LocalReportStore`: `localStorage`, shared by link | `ApiReportStore`: MongoDB, with recipients and access control |
| `ReportConfig` (zod, versioned) | stored locally and in links | stored unchanged in the `reports` collection |
| `flowConfig` | a file in the repo | editable on a settings page, saved on the server |

Two habits keep the backend move cheap:

- Every number stays in pure functions in `src/lib/jira/`. The backend moves that folder into a shared package, so the nightly snapshot job uses the same code as the browser.
- Report author is free text for now. Keep it a single field so it can become a user id once sign-in exists.

## Open questions

All five were answered on 26 Oct 2026.

| Question | Affects | Answer |
| --- | --- | --- |
| Should a new report default to live (newest data) or frozen (exactly what you saw)? | F3 | **Live**, as the default had it; frozen is one click away (decision 0006) |
| Where do PI objectives live today: a Jira issue type, Jira Align, Confluence, a spreadsheet? | F1 with real data | **A Jira issue type** linked to epics; the Trawler exports them and `trawler.ts` maps them (decision 0008) |
| Which statuses in your real workflow count as "waiting"? | F2 accuracy | **In Review and Blocked**, as the default had it (decision 0007) |
| Should the period picker get a custom date range now? It would help frozen reports. | F3 | **Yes**: added as "Custom range…" (decision 0021, superseding 0009) |
| Which pages should a new report include by default? | F3 | **Overview, Details, PI, Objectives and Flow** |

## Handoff notes for Claude Code

Export this doc to Markdown and save it as `docs/plan-frontend.md`, next to `PROJECT_CONTEXT.md`. Then run one phase per session.

1. Start each session with: "Read `docs/PROJECT_CONTEXT.md`, `docs/plan-frontend.md` and `CLAUDE.md`. Implement phase FN only. Use plan mode first and show me the plan before writing code."
2. Run F0 alone and merge it first.
3. Then run F1 and F2 in order. F3 can run in a parallel session on its own branch.
4. At the end of each phase, ask Claude Code to:
   - tick the acceptance boxes it met
   - update the README and `PROJECT_CONTEXT.md`
   - add a decision record for anything it chose that the plan left open

Rules that carry over:

- Every number comes from a pure, tested function in `src/lib/jira/`; components only display.
- No server calls, secrets or real data in this iteration; the site stays a public demo on GitHub Pages.
- New pages meet the existing definition of done: dark and light mode, 1440 px and 1024 px, and invalid input keeps the old data.
- Nothing outside this plan without asking.
