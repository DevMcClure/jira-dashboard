# Jira Dashboard

A proof-of-concept dashboard for Jira sprint data. It reads a JSON export from the Jira Trawler script and shows ticket counts, sprint progress, workload and how tickets move through the workflow. Everything runs in the browser.

## Run it

Needs Node 20.19+ and pnpm.

```bash
corepack enable pnpm   # one-time
pnpm start             # install, build and preview at http://localhost:4173
```

For development: `pnpm install` then `pnpm dev` (http://localhost:5173).

Other commands, all from the repo root: `pnpm test` (every package), `pnpm lint`, `pnpm build` (type-checks every package, then builds the web app into `apps/web/dist`), `pnpm mock:data` (regenerate the sample data), `pnpm snapshot:backfill --from … --to …` (api mode: rebuild past days' snapshots).

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
4. Sign in as one of the demo personas (`AUTH_PROVIDER=mock`): Sam Rivers (Scrum Master, an author), Morgan Lee (Manager, a viewer) or Ada Park (Admin).
5. Push an export like the Trawler would, and the open dashboard offers a Refresh within a minute:
   `curl -X POST localhost:3000/api/ingest -H "Authorization: Bearer change-me" --data-binary @apps/web/public/sample/jira-export.json`

Check it with `curl http://localhost:3000/api/health`. The API's routes so far:
- `GET /api/health`: the server and database status (public)
- `GET /api/config`: the mode, the sign-in provider, and which features are on (public)
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`: sign-in (login is limited to 10 attempts a minute per client)
- `GET /api/auth/personas`: the demo personas, with `AUTH_PROVIDER=mock` only
- `GET /api/dataset`: the current dataset, with an `ETag` per ingest (signed in only)
- `GET /api/dataset/meta`: which ingest is current, without the data (signed in only; the web app polls it every minute)
- `POST /api/ingest`: the Trawler pushes an export, with `Authorization: Bearer <INGEST_TOKEN>` (see `docs/trawler-integration.md`)
- `POST /api/ingest/upload`: an admin publishes a file from the Import page
- `GET /api/snapshots?teamId=&from=&to=`, `GET /api/snapshots/:teamId/:date`: stored daily snapshots (signed in only)
- `POST /api/jobs/snapshot`: an admin snapshots a day now (default yesterday)

Static mode has no sign-in: the GitHub Pages demo is unchanged.

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
| `TRUST_PROXY` | `true` behind a proxy that terminates TLS, so the session cookie is marked `Secure` |
| `AUTH_PROVIDER` | `crowd` (`mock` is for development only) |
| `SESSION_SECRET` | a random string of 32+ characters (the server refuses a weak one with `crowd`) |
| `SESSION_TTL_HOURS` | how long a sign-in lasts |
| `CROWD_URL` | your Crowd base URL, e.g. `https://crowd.example.com/crowd` |
| `CROWD_APP_NAME`, `CROWD_APP_PASSWORD` | the application you register for the dashboard in Crowd |
| `CROWD_REVALIDATE_MINUTES` | how often a session is re-checked with Crowd |
| `ROLE_GROUPS_ADMIN`, `ROLE_GROUPS_AUTHOR` | your Crowd groups for admins and report authors, comma-separated |
| `INGEST_TOKEN` | a random string of 32+ characters that the Trawler sends; empty turns push off |
| `INGEST_MAX_MB` | the largest export accepted |
| `TRAWLER_PULL_URL` or `TRAWLER_PULL_PATH`, `TRAWLER_PULL_CRON` | only if the dashboard pulls instead of the Trawler pushing |
| `SNAPSHOT_CRON`, `SNAPSHOT_TZ` | when the daily snapshot runs (or `off`), and your teams' time zone |
| `VITE_DATA_MODE`, `VITE_API_BASE_URL` | `api`, and where the web app reaches the server (build-time) |

Checklist:

- [ ] Copy `.env.example` to `.env` and fill in every value
- [ ] Build the web app with `VITE_DATA_MODE=api` and your `VITE_API_BASE_URL` (`pnpm build`)
- [ ] Build the server (`pnpm build:server`) and start it on your host (`pnpm start:server`, or `node --env-file=.env apps/server/dist/index.js`). It's a plain Node 22 process; deployment is up to you.
- [ ] Check `GET /api/health`, then sign in with a Crowd account
- [ ] Point the Trawler at `/api/ingest` with your `INGEST_TOKEN` (`docs/trawler-integration.md` has a ten-line Python snippet), or set up pull
- [ ] Optionally fill in history from before go-live: `node --env-file=.env apps/server/dist/backfill.js --from 2026-08-31 --to 2026-10-25`

### Sign-in with Crowd

1. In Crowd, add an application for the dashboard (a generic application). Its name and password go in `CROWD_APP_NAME` and `CROWD_APP_PASSWORD`. Allow the dashboard server's address under the application's remote addresses, and give it the directories your users are in.
2. Set `AUTH_PROVIDER=crowd`, `CROWD_URL`, and a long random `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
3. Put your Crowd group names in `ROLE_GROUPS_ADMIN` and `ROLE_GROUPS_AUTHOR`. Everyone else who can sign in is a viewer.
4. Serve the web app and the API from the same site (ideally the same origin, with the API under `/api`). The session cookie is `SameSite=Lax`, so a web app on another site can't send it.

People sign in with their Crowd username and password. The server checks them with Crowd, keeps the Crowd token encrypted in its own session (MongoDB, expiring after `SESSION_TTL_HOURS`), and gives the browser only a signed, httpOnly session cookie. Every `CROWD_REVALIDATE_MINUTES` it re-checks the session with Crowd and refreshes the user's groups. If Crowd is down, sign-in answers 503 and existing sessions carry on until their next check.

### The live Trawler feed

The Trawler pushes each run to `POST /api/ingest`, or the dashboard pulls it on a schedule; `docs/trawler-integration.md` covers both. Every export is checked by the same code as the Import page. An invalid one is rejected and recorded, and the current data stays. The server keeps the newest 10 datasets (larger ones in GridFS) and a record of every ingest. Open dashboards check for new data every minute and offer a Refresh that keeps your filters. On the Import page, admins can publish a previewed file to the server.

### Daily snapshots

Every morning (`SNAPSHOT_CRON`, default 06:00 in `SNAPSHOT_TZ`, default Europe/London) the server stores one snapshot per team for the day before. It's the day replayed from the changelog to its end, with the same numbers the dashboard shows: sprint totals and status counts, that day's burndown point, health, activity, objectives, flow (trailing 28 days) and a row per ticket. That builds a history that outlives the Trawler's exports, which only carry open sprints.

- Reruns change nothing: a snapshot with the same content isn't written again.
- If no new data arrived after a day ended, that day is still recorded from the latest data, marked **stale**.
- `pnpm snapshot:backfill --from 2026-08-31 --to 2026-10-25` rebuilds past days from the current data's changelog (marked **backfilled**). It never replaces a snapshot taken on the day unless you add `--force`, and it skips days the data doesn't reach yet. In a build, run `node --env-file=.env apps/server/dist/backfill.js` with the same flags.
- The **History** page shows a team's days from these snapshots: burndown, tickets by status, WIP, cycle time, health and a table of days. Admins can **Take snapshot now**.
- **As of** in the header (api mode) shows any past day across the whole dashboard. It replays the loaded data in the browser with the same function the snapshot job uses.

Shared reports arrive in the last phase of `docs/plan-backend.md`, adding its own variables here.

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
- `docs/trawler-integration.md`: how the Trawler sends its runs to the dashboard.
- Working notes (project context, earlier plans and decision records) are kept locally and aren't published.

## Built with

Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts and TanStack Table, in a pnpm workspace.
