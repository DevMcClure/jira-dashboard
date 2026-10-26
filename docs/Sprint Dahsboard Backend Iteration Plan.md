# Jira Dashboard: Backend Iteration Plan

Oct 26, 2026 · @Devan

## Summary

This iteration adds a small Node API and MongoDB behind the Jira Dashboard, so reports can be sent to real people, data arrives live from the Trawler, and every day is kept as a snapshot.

It starts after the Frontend Iteration Plan is merged, and relies on the four seams that iteration leaves behind: `DataSource`, `ReportStore`, the versioned `ReportConfig`, and `flowConfig`. Each phase here adds a server-backed implementation behind one of those seams, so pages change very little.

Six phases, one Claude Code session each, run strictly in order:

1. **B0 Restructure**: a pnpm workspace with a shared `core` package.
2. **B1 API and data source**: a Fastify server template that connects to any MongoDB through env settings (connection string, database, host, port), plus the web app's `ApiDataSource`. No real connection details.
3. **B2 Crowd auth**: a Crowd sign-in template with sessions and roles. It uses mock personas until you add your Crowd URL and app credentials.
4. **B3 Live Trawler feed**: an ingest endpoint template, so each Trawler run lands in the dashboard automatically once you set the token.
5. **B4 Daily snapshots**: one MongoDB document per team per day, written at 06:00.
6. **B5 Server-side reports**: reports with recipients, "Shared with me", and access control.

**This iteration is template work only.** No real data, connection strings, credentials, ports or hosts go into the code. Every connection point is read from environment variables, with placeholders in `.env.example`: Mongo, Crowd, the Trawler, and the server's own host and port. When you port the project into your environment, you fill in those values and deploy to your own server yourself. This plan includes no deployment or infrastructure work. The Configuration template section lists every value you will set.

The GitHub Pages build stays as a no-auth demo on mock data after every phase. Out of scope: conversations on reports, deployment, and production hardening.

## Target architecture

The project becomes one pnpm workspace with three packages. The metrics code moves into a shared package, so the browser and the nightly snapshot job compute numbers with exactly the same functions.

```
apps/
  web/        the current React app
  server/     new: Node 22 + Fastify + TypeScript API
packages/
  core/       src/lib/jira moved here: schema, adapter, trawler, metrics, period, scope, report, flowConfig, ReportConfig
.env.example             every setting, with placeholder values (committed)
.env                     your real values (git-ignored, created when you port it)
docker-compose.dev.yml   optional throwaway local Mongo for testing the templates; not used in your environment
```

The web app runs in one of two modes, chosen at build time by `VITE_DATA_MODE`:

| Mode | Data | Sign-in | Reports | Snapshots | Runs on |
| --- | --- | --- | --- | --- | --- |
| `static` | sample file plus upload | none | `localStorage` + links | none | GitHub Pages, unchanged |
| `api` | live from the server, refreshed on each ingest | Crowd (a mock provider in dev) | MongoDB, with recipients | daily, in MongoDB | your own server (you deploy it) |

Pages don't know which mode they're in. A feature that only exists in `api` mode (Snapshot history, "Shared with me") shows a short empty state in `static` mode.

The plan uses Fastify because it is small and TypeScript-friendly. It has first-party cookie, CORS and rate-limit plugins, and the zod schemas in `core` can validate request bodies. Any small Node framework would do; nothing in the plan depends on Fastify specifically.

## Phased plan

### B0: Restructure

Goal: workspace layout, with no change in behaviour.

- Convert the repo to a pnpm workspace: `apps/web`, `apps/server`, `packages/core`.
- Move `src/lib/jira/*` and its tests into `packages/core`.
- Update `CLAUDE.md` with the layout, the two modes, and the rule that server code also gets every number from `core`.

Acceptance:

- [ ] All tests pass from the workspace root
- [ ] The Pages build is unchanged

### B1: API and data source

Goal: a server template that loads the dashboard's data from MongoDB, where every connection detail comes from env.

- `apps/server` (Fastify):
  - `GET /api/health`, `GET /api/config` (the mode, and which features are on) and `GET /api/dataset` (the current dataset)
  - listens on `HOST` and `PORT`; accepts browser calls from `CORS_ORIGIN`; can sit under a sub-path via `BASE_PATH`
  - env validated with zod at startup; if a required value is missing, it refuses to start and lists what's missing
- MongoDB connection (`db.ts`):
  - connects with `MONGO_URI` and `MONGO_DB_NAME`, so it works with any Mongo, including your own server
  - optional TLS settings (`MONGO_TLS_CA_FILE`) for when your Mongo needs them
  - creates its indexes on startup
  - when the database is empty and `SEED_MOCK=true`, loads the mock data so there's something to look at
- `pnpm --filter server build` and `start` produce a plain Node process you can run on your server. No Dockerfile, deployment scripts or hosting config are included.
- For testing locally only: an optional `docker-compose.dev.yml` that starts a throwaway Mongo, so the templates can be exercised before you port them.
- Web: `ApiDataSource` behind the existing `DataSource` seam; `VITE_DATA_MODE` picks it; `VITE_API_BASE_URL` says where the API lives. The Vite dev server proxies `/api` locally.

Acceptance:

- [ ] With the local dev Mongo, `pnpm dev` shows the same dashboard served through the API
- [ ] Pointing at a different Mongo, host or port needs only `.env` changes, no code changes
- [ ] `static` mode still builds and deploys to Pages

### B2: Crowd auth

Goal: users sign in and have roles, and Crowd is wired up ready for real credentials.

- An `AuthProvider` interface: `login(username, password)`, `validate(session)`, `logout(session)`, `groupsFor(user)`.
- `MockAuthProvider` for dev: three personas on the login page (Scrum Master, Manager, Admin).
- `CrowdAuthProvider`, using Crowd's REST `usermanagement` API:
  - The app authenticates to Crowd with its application name and password (Basic auth).
  - `POST /rest/usermanagement/1/session` creates the user's SSO token; `POST /session/{token}` validates it; `DELETE /session/{token}` logs out.
  - `GET /user/group/nested?username=` reads the user's groups.
  - Unit-tested against a mocked Crowd HTTP server.
- Our own session:
  - an httpOnly, signed, SameSite=Lax cookie holding a session id
  - the session itself, including the Crowd token, lives in a Mongo `sessions` collection with a TTL index
  - the Crowd token is revalidated every `CROWD_REVALIDATE_MINUTES`
- Roles come from Crowd groups, set in env:
  - `ROLE_GROUPS_ADMIN` and `ROLE_GROUPS_AUTHOR`; anyone else who can sign in is a viewer
  - authors create and share reports; admins also publish data and run jobs
- A stub `OidcAuthProvider` with a TODO, in case SSO sits in front of Crowd.
- Web: a `/login` page, a route guard, the real user row with sign-out, and `useCurrentUser()`. Report `author` becomes the signed-in user's id.
- `.env.example` lists every variable with placeholder values: `AUTH_PROVIDER=mock|crowd`, `CROWD_URL`, `CROWD_APP_NAME`, `CROWD_APP_PASSWORD`, `SESSION_SECRET`, and the role group names.

Acceptance:

- [ ] Mock personas sign in and out; API routes return 401 without a session
- [ ] Switching to `AUTH_PROVIDER=crowd` needs only env values, no code changes
- [ ] No secret is in the repo or the web bundle

### B3: Live Trawler feed

Goal: every Trawler run lands in the dashboard without a manual upload.

- **Push (primary):** `POST /api/ingest`
  - `Authorization: Bearer <INGEST_TOKEN>`; gzip accepted; body size capped by `INGEST_MAX_MB`
  - accepts raw Trawler output or the contract JSON, through the same `core` adapter as the Import page
- An invalid payload gets a 422 with readable errors, and the current dataset is untouched.
- A valid payload is stored as metadata in `ingests` and the parsed dataset in `datasets` (GridFS if it is over 16 MB), then marked current.
- **Pull (optional):** `TRAWLER_PULL_URL` or `TRAWLER_PULL_PATH`, plus `TRAWLER_PULL_CRON`, for when the Trawler can't call out.
- `docs/trawler-integration.md` with a ten-line Python snippet the Trawler runs after each trawl.
- Web:
  - poll `GET /api/dataset/meta` every 60 s; when the ingest id changes, show a toast with a Refresh action
  - the sidebar line reads "Data: live · trawled 08:15"
- Import page in `api` mode:
  - "Preview locally": today's behaviour, for everyone
  - "Publish to server": admins only, through the same ingest pipeline

Acceptance:

- [ ] A `curl` of the mock export into `/api/ingest` updates an open dashboard within a minute
- [ ] A bad payload is rejected and the old data stays

### B4: Daily snapshots

Goal: a growing history, one document per team per day.

- A scheduled job (`croner` or `node-cron`):
  - runs on `SNAPSHOT_CRON=0 6 * * *` in `SNAPSHOT_TZ=Europe/London`
  - snapshots the previous calendar day
- For each team, it replays the changelog to 23:59:59 of that day using `core` functions. It then writes the day's totals, status counts, burndown point, health, objectives and flow numbers, plus one row per ticket (see the data model).
- It is idempotent: an upsert on `(teamId, date)`, so reruns never duplicate.
- Backfill: `pnpm snapshot:backfill --from 2026-08-31 --to 2026-10-25` rebuilds past days from changelog replay.
  - Fields the changelog doesn't track (summary, epic, labels) use their current values.
  - Backfilled documents carry `backfilled: true`.
- If no ingest arrived after the day ended, the job still writes the snapshot, flagged `stale: true`.
- API:
  - `GET /api/snapshots?teamId=&from=&to=`
  - `GET /api/snapshots/:teamId/:date`
  - `POST /api/jobs/snapshot` (admin only; runs the job now)
- Web:
  - an "As of" date control in the header that loads a past day
  - a Snapshot history page with day-by-day trends, read from snapshots rather than replay

Acceptance:

- [ ] A manual run writes one document per team; a rerun changes nothing
- [ ] Backfilled PI 26.4 matches the live burndown for the same days

### B5: Server-side reports

Goal: send a report to a person; when they sign in, they see it.

- An `ApiReportStore` behind the `ReportStore` seam saves the same `ReportConfig` into MongoDB. Each report adds an owner and recipients (users and Crowd groups).
- Frozen reports also store the ingest id and the computed report payload, so they read the same forever.
- A Share dialog with user and group search: `GET /api/directory/search`, backed by Crowd search in production and the personas in dev.
- "My Reports" gains **Shared with me** (with an unread badge, from `report_reads`) next to **Created by me**.
- A one-time "Import my local reports" action moves `localStorage` reports to the server.
- Access is checked on the server for every report request. Link sharing still works, but the link now carries the report id, and opening it needs access.

Acceptance:

- [ ] Scrum Master persona shares "WEB 26.4.4 status" with the Manager persona
- [ ] The Manager signs in, finds it under Shared with me, and sees exactly those filters on the included pages
- [ ] The Manager gets a 403 on a report not shared with them

## MongoDB data model

The data lives in seven collections in one database, `jira_dashboard`. Snapshots are one document per team per day. That keeps each document well under Mongo's 16 MB limit, and makes "team X over the sprint" a single indexed query.

| Collection | One document is | Key fields | Indexes |
| --- | --- | --- | --- |
| `ingests` | one Trawler run or published upload | `_id`, `receivedAt`, `source` (push / pull / upload), `generatedAt`, `counts`, `status` (current / superseded / rejected), `errors?`, `datasetId` | `receivedAt` desc; partial unique on `status: current` |
| `datasets` | the parsed contract JSON of one ingest | `_id`, `ingestId`, `data` (or a GridFS file id when large) | `ingestId` |
| `daily_snapshots` | one team on one day | see below | unique `(teamId, date)`; `(sprintId, date)`; `(piId, date)` |
| `reports` | one saved report | `_id`, `ownerId`, `config` (the frontend's `ReportConfig`), `recipients { users[], groups[] }`, `frozen? { ingestId, payload }`, `createdAt`, `updatedAt` | `ownerId`; `recipients.users`; `recipients.groups` |
| `report_reads` | a user's last open of a report | `reportId`, `userId`, `lastReadAt` | unique `(reportId, userId)` |
| `sessions` | one signed-in browser | `_id`, `userId`, `roles`, `crowdToken` (encrypted), `expiresAt`, `lastValidatedAt` | TTL on `expiresAt` |
| `users` | a cache of people who have signed in | `_id` (Crowd username), `displayName`, `email`, `groups`, `lastSeenAt` | `email` |

A `daily_snapshots` document (the values are illustrative):

```json
{
  "schemaVersion": 1,
  "teamId": "WEB",
  "date": "2026-10-19",
  "takenAt": "2026-10-20T06:00:04Z",
  "ingestId": "...",
  "stale": false,
  "backfilled": false,
  "sprint": { "id": "...", "name": "WEB 26.4.4", "dayOfSprint": 6, "workingDaysTotal": 10 },
  "pi": { "id": "PI-26.4", "name": "PI 26.4", "pctTimeElapsed": 0.71 },
  "totals": { "tickets": 31, "points": 58, "pointsDone": 29, "pointsRemaining": 29, "scopeAddedToday": 2 },
  "statusCounts": { "To Do": 7, "In Progress": 9, "In Review": 4, "Blocked": 2, "QA": 3, "Done": 6 },
  "health": "at_risk",
  "activity": { "moves": 14, "created": 2, "resolved": 3, "blockedNew": 1 },
  "flow": { "velocity": 3, "wip": 18, "avgAgeDays": 4.2, "efficiency": 0.41, "cycleTimeP85": 7.5 },
  "objectives": [ { "id": "...", "progress": 0.48, "health": "on_track" } ],
  "issues": [
    { "key": "WEB-412", "type": "Story", "status": "In Review", "points": 3,
      "assigneeId": "p7", "epicKey": "WEB-400", "ageDays": 5, "daysInStatus": 1 }
  ]
}
```

The shape comes from a zod schema in `core`. The `schemaVersion` field lets the web app read old snapshots safely as the schema grows.

## Configuration template

Everything you will set when porting lives in `.env` (server) or is passed at build time (web). `.env.example` is committed with the placeholders below; `.env` is git-ignored. Claude Code writes this file and a matching "Porting to your environment" section in the README, and fills in nothing real.

| Variable | Phase | Placeholder in `.env.example` | What you set it to |
| --- | --- | --- | --- |
| `HOST` | B1 | `0.0.0.0` | the interface your server listens on |
| `PORT` | B1 | `3000` | your server's port |
| `BASE_PATH` | B1 | `/` | a sub-path, if the app sits behind one |
| `CORS_ORIGIN` | B1 | `http://localhost:5173` | the URL the web app is served from |
| `LOG_LEVEL` | B1 | `info` | as needed |
| `MONGO_URI` | B1 | `mongodb://localhost:27017` | your Mongo connection string |
| `MONGO_DB_NAME` | B1 | `jira_dashboard` | your database name |
| `MONGO_TLS_CA_FILE` | B1 | empty | path to a CA file, if your Mongo uses TLS |
| `SEED_MOCK` | B1 | `true` | `false` once real data flows |
| `AUTH_PROVIDER` | B2 | `mock` | `crowd` |
| `SESSION_SECRET` | B2 | `change-me` | a long random string |
| `SESSION_TTL_HOURS` | B2 | `12` | as needed |
| `CROWD_URL` | B2 | `https://crowd.example.com/crowd` | your Crowd base URL |
| `CROWD_APP_NAME` | B2 | `jira-dashboard` | the application name registered in Crowd |
| `CROWD_APP_PASSWORD` | B2 | `change-me` | that application's password |
| `CROWD_REVALIDATE_MINUTES` | B2 | `15` | as needed |
| `ROLE_GROUPS_ADMIN` | B2 | `jira-dashboard-admins` | your Crowd group(s) for admins, comma-separated |
| `ROLE_GROUPS_AUTHOR` | B2 | `jira-dashboard-authors` | your Crowd group(s) for report authors |
| `INGEST_TOKEN` | B3 | `change-me` | a shared secret the Trawler sends |
| `INGEST_MAX_MB` | B3 | `50` | as needed |
| `TRAWLER_PULL_URL` / `TRAWLER_PULL_PATH` | B3 | empty | only if the dashboard pulls instead of the Trawler pushing |
| `TRAWLER_PULL_CRON` | B3 | empty | the pull schedule, if used |
| `SNAPSHOT_CRON` | B4 | `0 6 * * *` | as needed |
| `SNAPSHOT_TZ` | B4 | `Europe/London` | as needed |
| `VITE_DATA_MODE` | B1 (web build) | `static` | `api` |
| `VITE_API_BASE_URL` | B1 (web build) | `/api` | where the web app reaches the server |

Porting checklist, as it will appear in the README:

- [ ] Copy `.env.example` to `.env` and fill in every value above
- [ ] Build the web app with `VITE_DATA_MODE=api` and your `VITE_API_BASE_URL`
- [ ] Build and start the server on your host
- [ ] Check `GET /api/health`, then sign in with a Crowd account
- [ ] Point the Trawler at `/api/ingest` with your `INGEST_TOKEN`

## Open questions

None of these block B0 or B1. Until one is answered, the plan uses the default shown.

| Question | Affects | Default until answered |
| --- | --- | --- |
| How do your other internal apps sign in through Crowd: username and password over the REST API, Crowd's SSO cookie, or an SSO provider (SAML or OIDC) in front of it? | B2 go-live | Crowd REST sessions, with the OIDC stub left in place |
| Which Crowd groups map to admin, author and viewer? | B2 go-live | env placeholders |
| Can the Trawler make an outbound HTTP call after each run, or must the dashboard pull? | B3 | push, with pull as an option |
| Which day boundary should snapshots use: Europe/London midnight, or each team's own time zone? | B4 | Europe/London |
| If objectives aren't in Jira, should authors maintain them in the app (a Mongo `objectives` collection)? | after B5 | not this iteration |

## Handoff notes for Claude Code

Export this doc to Markdown and save it as `docs/plan-backend.md`. Start only once the frontend iteration is merged. Run one phase per session, in order.

1. Start each session with: "Read `docs/PROJECT_CONTEXT.md`, `docs/plan-backend.md` and `CLAUDE.md`. Implement phase BN only. Use plan mode first and show me the plan before writing code."
2. At the end of each phase, ask Claude Code to:
   - tick the acceptance boxes it met
   - update the README and `PROJECT_CONTEXT.md`
   - add a decision record for anything it chose that the plan left open

Rules that carry over and get stricter:

- Every number comes from a pure, tested function in `core`; the snapshot job calls the same functions as the browser.
- Template only: no real hosts, ports, connection strings or credentials in code. Every one is an env variable listed in the Configuration template, with a placeholder in `.env.example`. CI fails if a `.env` file is committed.
- No deployment work: no Dockerfiles for production, hosting config or infrastructure scripts.
- `static` mode keeps working after every phase. It is the public demo on GitHub Pages and must never contain real data.
- Nothing outside this plan without asking.
