# Jira Dashboard

A proof-of-concept dashboard for Jira sprint data. It reads a JSON export from the Jira Trawler script and shows ticket counts, sprint progress, workload and how tickets move through the workflow. Everything runs in the browser.

## Run it

Needs Node 20.19+ and pnpm.

```bash
corepack enable pnpm   # one-time
pnpm start             # install, build and preview at http://localhost:4173
```

For development: `pnpm install` then `pnpm dev` (http://localhost:5173).

Other commands, all from the repo root: `pnpm test` (every package), `pnpm lint`, `pnpm build` (type-checks every package, then builds the web app into `apps/web/dist`), `pnpm mock:data` (regenerate the sample data).

## Repository layout

A pnpm workspace:

| Package | What it is |
| --- | --- |
| `apps/web` (`@jira-dashboard/web`) | The React dashboard (Vite). It's what GitHub Pages serves. |
| `packages/core` (`@jira-dashboard/core`) | The Jira data contract, the Trawler adapter and every number the dashboard shows: metrics, flow, periods, scope, the Markdown report and the report config. It's pure TypeScript, shared by the web app and (from phase B1) the server, so both compute the same numbers. |
| `apps/server` (`@jira-dashboard/server`) | The API (Node 22, Fastify, MongoDB). It serves the dashboard's data from any MongoDB, configured entirely through environment variables. |

Run a single package with `pnpm --filter <name> <script>`, e.g. `pnpm --filter core test`.

## Two build modes

The web app is built in one of two modes, set by `VITE_DATA_MODE`:

| Mode | Data | Runs on |
| --- | --- | --- |
| `static` (default) | the bundled sample, plus files you upload | GitHub Pages: the public demo, never real data |
| `api` | the server's current dataset, from MongoDB | your own server, which you deploy |

Pages don't know which mode they're in.

## Run with the API locally

For trying the server template on your machine:

1. Start a MongoDB: `pnpm db:dev` starts a throwaway one in Docker (`docker-compose.dev.yml`), or run your own `mongod`.
2. `cp .env.example .env`; the placeholders work for local testing as they are.
3. `pnpm dev:api` starts the API (on `PORT`, default 3000, with `SEED_MOCK=true` loading the mock data into an empty database) and the web app in `api` mode at http://localhost:5173. The dev server forwards `/api` to the API.

Check it with `curl http://localhost:3000/api/health`. The API has three routes so far:
- `GET /api/health`: the server and database status
- `GET /api/config`: the mode, and which features are on
- `GET /api/dataset`: the current dataset, with an `ETag` per ingest

## Porting to your environment

Everything you set lives in a `.env` at the repo root (git-ignored), or in the real environment. `.env.example` lists every variable with a placeholder, and CI fails if a `.env` file is ever committed. Nothing real is in the code.

| Variable | What you set it to |
| --- | --- |
| `HOST`, `PORT` | the interface and port your server listens on |
| `BASE_PATH` | a sub-path, if the app sits behind one (`/` for none) |
| `CORS_ORIGIN` | the URL(s) the web app is served from, comma-separated |
| `LOG_LEVEL` | as needed |
| `MONGO_URI`, `MONGO_DB_NAME` | your Mongo connection string and database name |
| `MONGO_TLS_CA_FILE` | path to a CA file, if your Mongo uses TLS with a private CA |
| `SEED_MOCK` | `false` once real data flows |
| `VITE_DATA_MODE`, `VITE_API_BASE_URL` | `api`, and where the web app reaches the server (build-time) |

Checklist:

- [ ] Copy `.env.example` to `.env` and fill in every value
- [ ] Build the web app with `VITE_DATA_MODE=api` and your `VITE_API_BASE_URL` (`pnpm build`)
- [ ] Build the server (`pnpm build:server`) and start it on your host (`pnpm start:server`, or `node --env-file=.env apps/server/dist/index.js`). It's a plain Node 22 process; deployment is up to you.
- [ ] Check `GET /api/health`

Sign-in, the live Trawler feed, snapshots and shared reports arrive in later phases of `docs/plan-backend.md`, each adding its own variables here.

## Deploy to GitHub Pages

Every push to `main` builds and deploys the site to https://devmcclure.github.io/jira-dashboard/ (see `.github/workflows/deploy.yml`).

One-time setup: in the repo on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

## Use real data

- **Quick:** open the **Import** page and drop in a Trawler JSON file, or the Trawler's audit `.log` (its `PROJECT` / `TICKET` lines are read directly).
- **As the default:** replace `apps/web/public/sample/jira-export.json` (or regenerate it with `pnpm run mock:data`). ⚠️ Anything bundled is published on GitHub Pages, so don't commit real company data. Use the Import page for that (files stay in your browser).

The Import page shows an example of the expected format, and `packages/core/src/schema.ts` defines it exactly. If the real export looks different, only `packages/core/src/adapter.ts` (and `schema.ts`) need to change.

Raw Trawler output (projects + tickets with Jira's own field names) is recognised automatically and converted in `packages/core/src/trawler.ts`: each project becomes a team, and people are taken from assignee/reporter/creator. The Trawler runs with `sprint_open: true`, so each project's tickets are put in one active "current sprint". Story points (`storyPoints`, `story_points` or `"Story Points"`) and history (Jira's native `changelog.histories[].items[]`) are read when present and drive the movement, cycle-time and points charts. The export has no sprint dates, so burndown and velocity stay empty, and sprint health can't compare progress against time elapsed.

## Program increments (PI)

A PI is 10 weeks: 5 two-week sprints, with the same dates for every team. The header's **scope** picker switches between the **current sprint** (the default) and a **whole PI**. Every page follows the scope. The **PI** page shows the PI's burnup, a sprint-by-sprint calendar for each team, per-team progress and epic progress.

For this to work, the export needs a top-level `programIncrements` list (id, name, start/end dates, optional objectives) and a `piId` on each sprint. A sprint without a `piId` is placed in a PI by its dates. Epics (issues of type `Epic`, linked from stories through `epicKey`) stand in for PI features. Exports without PIs, like today's Trawler output, work as before and the scope picker stays hidden. When the expanded Trawler can pull a whole PI, map its output in `packages/core/src/trawler.ts`.

## Objectives

The **Objectives** page shows the PI's objectives. For each one you see business value, progress rolled up from its epics' tickets, health against the time gone, and a forecast for the end of the PI. For a closed PI it also shows **predictability** (actual ÷ planned business value of committed objectives). Objectives come from the export's `programIncrements[].objectives`; older exports with plain-string objectives still load.

## Flow metrics

The **Flow** page shows the six SAFe flow metrics, counted in items and time rather than story points. It leads with the two primary targets, **flow time** and **flow load**:
- **Flow time** is shown from created (the default) or from work started; there's a switch.
- Weekly flow time is lined up against throughput.
- An aging chart shows which open items are drifting.

After that come a **WIP vs throughput** view for finding the right amount of work in progress, and a per-team table (team level only). Velocity, efficiency, distribution (now vs finished, plus the size of finished items) and predictability follow as supporting metrics. A history meter and sample-size notes show how far to trust the numbers, and **"How these are measured"** lists every definition. It defaults to working hours (Mon–Fri 09:00–18:00 London), with a switch to calendar time. Which statuses count as active or waiting, and how Jira types map to flow types, is set in `packages/core/src/flowConfig.ts`. Based on SAFe and the DX guide at https://getdx.com/blog/flow-metrics/.

## Export a report

The **Export** page builds a Markdown report of the dashboard. Pick the scope (current sprint or a whole PI), teams, sprints, time period (a preset or a custom range of days) and sections (summary, program increment, objectives, flow, teams, sprints, status breakdown, people, movements), check the live preview, then download the `.md` file or copy it. It starts from the header's current filters. The report is generated in `packages/core/src/report.ts`.

## Reports

**Save as report** (in the header, or on the Export page) saves the current filters, scope and period as a named report, either **live** (re-applied to the newest data) or **frozen** (pinned dates). Reports appear under **My Reports** in the sidebar. Opening one shows the dashboard set up that way, with the filters locked and only the chosen pages. **Copy link** gives a `/r?c=…` link that carries the whole report, so it opens in any browser without saving anything. **Explore from here** copies the report's filters into your own view to keep exploring. Reports are kept in this browser for now; a backend will store them later without changing the screens.

## Project docs

- `docs/plan-backend.md`: the current iteration plan (API, Crowd sign-in, live Trawler feed, MongoDB snapshots, server-side reports).
- Working notes (project context, earlier plans and decision records) are kept locally and aren't published.

## Built with

Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts and TanStack Table, in a pnpm workspace.
