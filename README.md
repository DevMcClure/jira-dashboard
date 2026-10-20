# Jira Dashboard

A proof-of-concept dashboard for Jira sprint data. It reads a JSON export from the Jira Trawler script and shows ticket counts, sprint progress, workload and how tickets move through the workflow. Everything runs in the browser.

![Jira Dashboard overview](docs/screenshot-overview.png)

## Run it

Needs Node 20.19+ and pnpm.

```bash
corepack enable pnpm   # one-time
pnpm start             # install, build and preview at http://localhost:4173
```

For development: `pnpm install` then `pnpm dev` (http://localhost:5173).

Other commands: `pnpm test`, `pnpm lint`, `pnpm mock:data` (regenerate the sample data).

## Deploy to GitHub Pages

Every push to `main` builds and deploys the site to https://devmcclure.github.io/jira-dashboard/ (see `.github/workflows/deploy.yml`).

One-time setup: in the repo on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

## Use real data

- **Quick:** open the **Import** page and drop in a Trawler JSON file, or the Trawler's audit `.log` (its `PROJECT` / `TICKET` lines are read directly).
- **As the default:** replace `src/data/jira-export.json`. ⚠️ Anything bundled is published on GitHub Pages, so don't commit real company data. Use the Import page for that (files stay in your browser).

The Import page shows an example of the expected format, and `src/lib/jira/schema.ts` defines it exactly. If the real export looks different, only `src/lib/jira/adapter.ts` (and `schema.ts`) need to change.

Raw Trawler output (projects + tickets with Jira's own field names) is recognised automatically and converted in `src/lib/jira/trawler.ts`: each project becomes a team, and people are taken from assignee/reporter/creator. The Trawler runs with `sprint_open: true`, so each project's tickets are put in one active "current sprint". Story points (`storyPoints`, `story_points` or `"Story Points"`) and history (Jira's native `changelog.histories[].items[]`) are read when present and drive the movement, cycle-time and points charts. The export has no sprint dates, so burndown and velocity stay empty, and sprint health can't compare progress against time elapsed.

## Export a report

The **Export** page builds a Markdown report of the dashboard. Pick the teams, sprints, time period and sections (summary, teams, sprints, status breakdown, people, movements), check the live preview, then download the `.md` file or copy it. It starts from the header's current filters. The report is generated in `src/lib/jira/report.ts`.

## Built with

Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts and TanStack Table.
