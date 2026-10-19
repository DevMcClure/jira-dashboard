# 02 — Data Contract

The dashboard consumes one JSON file: the output of the **Jira Trawler** script, which gathers all tickets (and their history) for a chosen set of teams and sprints.

> **Important:** the exact Trawler output shape isn't finalised. This document defines the dashboard's *expected* format. If the real Trawler output differs, **only `src/lib/jira/adapter.ts` changes** — it maps whatever comes in to the domain model below. Keep the rest of the app ignorant of the raw shape.

---

## File shape (`src/data/jira-export.json`)

```jsonc
{
  "meta": {
    "source": "jira-trawler",
    "version": "1.0",
    "generatedAt": "2026-10-19T08:00:00Z",       // ISO 8601
    "jiraBaseUrl": "https://example.atlassian.net", // used to build "Open in Jira" links
    "query": {
      "teamIds": ["TEAM-PLAT", "TEAM-WEB"],
      "sprintIds": [101, 102, 103]
    }
  },
  "teams": [
    {
      "id": "TEAM-PLAT",
      "name": "Platform",
      "projectKey": "PLAT",
      "memberIds": ["u-01", "u-02"]
    }
  ],
  "people": [
    {
      "id": "u-01",
      "displayName": "Priya Shah",
      "email": "priya.shah@example.com",  // optional
      "avatarUrl": null                    // optional; fall back to initials
    }
  ],
  "sprints": [
    {
      "id": 101,
      "name": "PLAT Sprint 41",
      "teamId": "TEAM-PLAT",
      "state": "closed",                  // "future" | "active" | "closed"
      "goal": "Ship the new billing webhooks",
      "startDate": "2026-09-14T09:00:00Z",
      "endDate": "2026-09-27T17:00:00Z",
      "completeDate": "2026-09-27T16:30:00Z" // null unless closed
    }
  ],
  "issues": [
    {
      "key": "PLAT-1234",
      "id": "10234",
      "summary": "Retry failed webhook deliveries",
      "description": "Plain text or markdown. May be null.",
      "type": "Story",                    // "Story" | "Bug" | "Task" | "Sub-task" | "Epic" | "Spike"
      "status": "In Progress",            // current status name
      "statusCategory": "in_progress",    // "todo" | "in_progress" | "done"  (drives colours/metrics)
      "priority": "High",                 // "Highest" | "High" | "Medium" | "Low" | "Lowest"
      "assigneeId": "u-01",               // null = unassigned
      "reporterId": "u-02",
      "teamId": "TEAM-PLAT",
      "sprintIds": [101, 102],            // all sprints it has been in (carry-over = >1)
      "storyPoints": 5,                   // null allowed
      "labels": ["billing", "backend"],
      "epicKey": "PLAT-1100",             // null allowed
      "parentKey": null,
      "created": "2026-09-10T11:22:00Z",
      "updated": "2026-10-16T14:05:00Z",
      "resolved": null,                   // ISO when statusCategory = done
      "dueDate": null,
      "changelog": [
        {
          "at": "2026-09-15T10:00:00Z",
          "authorId": "u-01",
          "field": "status",              // "status" | "assignee" | "sprint" | "storyPoints" | "priority"
          "from": "To Do",
          "to": "In Progress"
        },
        {
          "at": "2026-09-15T10:01:00Z",
          "authorId": "u-02",
          "field": "assignee",
          "from": null,
          "to": "u-01"
        }
      ]
    }
  ]
}
```

### Status workflow
Statuses and their category (keep this list in `src/lib/jira/constants.ts`, including a colour token per status):

| Status | Category | Colour token |
|---|---|---|
| To Do | todo | `--status-todo` (slate) |
| In Progress | in_progress | `--status-progress` (blue) |
| In Review | in_progress | `--status-review` (violet) |
| Blocked | in_progress | `--status-blocked` (red) |
| QA | in_progress | `--status-qa` (amber) |
| Done | done | `--status-done` (teal/green — match the green dots in the reference) |

The adapter must tolerate **unknown statuses**: fall back to the issue's `statusCategory` for colour and grouping.

---

## Zod & adapter rules
- `schema.ts`: strict on required fields (`key`, `summary`, `status`, `statusCategory`, `created`, `changelog`), lenient on optional ones (`.nullable().optional()`), `.passthrough()` on objects so extra Trawler fields don't break validation.
- `adapter.ts` → `parseExport(raw: unknown): JiraDataset` returns:
  ```ts
  type JiraDataset = {
    meta: Meta
    teams: Team[]; people: Person[]; sprints: Sprint[]; issues: Issue[]
    byKey: Map<string, Issue>
    personById: Map<string, Person>
    sprintById: Map<number, Sprint>
    teamById: Map<string, Team>
    transitions: Transition[] // flattened status changes across all issues, sorted by time
  }
  type Transition = { issueKey: string; at: Date; authorId: string | null; from: string | null; to: string; msInPrevious: number | null }
  ```
- Convert every ISO string to `Date` once, in the adapter.
- Sort each changelog ascending by `at`. Compute `msInPrevious` from the previous status change (or `created` for the first).
- Missing person references → synthesise a person named "Unknown (u-xx)" rather than crash.
- On zod failure, throw an error whose message lists the first 5 issues as `path: message`.

---

## Metrics (`src/lib/jira/metrics.ts`, all pure, all tested)
All functions take issues (already filtered) and, where relevant, a reference date `now` (default: `meta.generatedAt`, **not** the real clock — this keeps mock data looking alive regardless of when the POC is demoed).

| Function | Returns |
|---|---|
| `countByStatusCategory(issues)` | `{ todo, in_progress, done, total }` |
| `countByStatus(issues)` | `{ status, count, colorVar }[]` |
| `remainingPoints(issues)` | sum of story points not done |
| `createdSince(issues, date)` / `resolvedSince(issues, date)` | counts — used for "+N this week" deltas |
| `burndown(sprint, issues)` | per-day `{ date, ideal, remaining }` from sprint start to end (or `now`) using changelog to know when points were completed; points added mid-sprint raise `remaining` |
| `scopeChange(sprint, issues)` | points added / removed after sprint start |
| `sprintHealth(sprint, issues, now)` | `{ pctDone, daysLeft, level: "on_track" \| "at_risk" \| "off_track" \| "completed" }` — at risk if % done trails % time elapsed by >15pts, off track if >30pts |
| `velocity(team, sprints, issues)` | completed points per closed sprint |
| `workloadByPerson(issues)` | per person counts by category + points (include `null` = Unassigned) |
| `transitionsPerDay(transitions, range)` | per day, counts by destination status |
| `createdVsResolvedPerDay(issues, range)` | per day `{ created, resolved }` |
| `cumulativeFlow(issues, range)` | per day, number of tickets in each status at end of day (replay changelog) |
| `ticketAgeDays(issue, now)` | days since created (or created→resolved if done) |
| `cycleTimeDays(issue)` | first In Progress → Done, null if not done |

---

## Mock data generator (`scripts/generate-mock-data.ts`)
Run with `npm run mock:data`. Must be **deterministic** (implement a tiny seeded PRNG, e.g. mulberry32, seed `42`) so the committed JSON is stable.

Generate:
- `meta.generatedAt` = **2026-10-19T08:00:00Z** (fixed).
- **3 teams**: Platform (PLAT), Web (WEB), Mobile (MOB). 4–6 people each, 1 person shared across two teams. Realistic varied names.
- **3 sprints per team** (9 total), two-week cadence: two `closed`, one `active` (currently ~60% elapsed on `generatedAt`). Plus 1 `future` sprint per team with a few tickets.
- **~180 issues** total:
  - type mix ≈ Story 50%, Task 25%, Bug 20%, Spike 5%
  - story points from {1, 2, 3, 5, 8, 13}, ~10% null
  - closed sprints: ~85% done, the rest carried over into the next sprint (`sprintIds` has 2 entries, plus a `sprint` changelog entry)
  - active sprint: mix of all statuses — roughly 35% done, 30% in progress, 10% review, 8% blocked, 5% QA, 12% to do
  - ~8% unassigned, ~5% added mid-sprint (created after sprint start)
  - realistic summaries per team domain (billing, auth, dashboards, onboarding, push notifications, API rate limits, etc.) — build from template arrays, don't produce lorem ipsum
- **Changelogs** must be internally consistent: start at To Do on `created`, walk forward through the workflow with plausible gaps (hours to days, weekdays only, 09:00–18:00), occasionally go back (Review → In Progress, QA → In Progress), Blocked → back to In Progress. The last status entry must equal `issue.status`; `resolved` = time of the final Done transition; `updated` = last changelog time.
- Write to `src/data/jira-export.json` with 2-space indentation, and print a summary (counts per team / sprint / status).

Also commit a tiny `src/lib/jira/__fixtures__/small-export.json` (3 issues, 1 sprint) for unit tests.