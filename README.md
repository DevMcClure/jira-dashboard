# Jira Dashboard

A dashboard for Jira sprint and PI data. It reads the JSON export from the Jira Trawler script and shows sprint progress, burndowns, PI objectives, flow metrics, workload and how tickets move through the workflow. Views can be saved as reports.

It runs two ways:

- **Static:** everything in the browser, with the bundled sample data or an export you import. This is the public demo at https://devmcclure.github.io/jira-dashboard/.
- **With the server:** live data from the Trawler, sign-in through Crowd, daily history and shared reports, using a small Node API and MongoDB.

## Run it

Needs Node 22 and pnpm (`corepack enable pnpm`).

**Static:**

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

**With the server:**

```bash
pnpm install
pnpm db:dev                 # a throwaway MongoDB in Docker (or run your own)
cp .env.example .env        # the placeholders work as they are for local use
pnpm dev:api                # API + web app at http://localhost:5173
```

Sign in as one of the demo users (Scrum Master, Manager or Admin). For real use, fill in `.env`; each setting is explained there.
