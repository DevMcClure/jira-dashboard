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

- **Quick:** open the **Import** page and drop in a Trawler JSON file.
- **As the default:** replace `src/data/jira-export.json`. ⚠️ Anything bundled is published on GitHub Pages, so don't commit real company data. Use the Import page for that (files stay in your browser).

The expected format is in [`docs/02-DATA_CONTRACT.md`](docs/02-DATA_CONTRACT.md). If the real export looks different, only `src/lib/jira/adapter.ts` (and `schema.ts`) need to change.

## Built with

Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts and TanStack Table.
