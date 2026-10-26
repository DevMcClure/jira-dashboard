# 0002. Sample data is fetched from `public/`, not bundled

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F0

## Context
The sample export (~750 KB of JSON for two PIs) was imported into the entry chunk, making it ~1 MB and triggering Vite's chunk-size warning.

## Decision
The mock generator writes `public/sample/jira-export.json`. At startup the app fetches `${BASE_URL}sample/jira-export.json` (so it works under GitHub Pages' `/jira-dashboard/` sub-path). Until the first load finishes, a full-screen skeleton is shown. If the fetch fails, an error card offers Retry and "Import a file". A remembered upload loads with no network request.

## Consequences
- Entry chunk ~1,000 KB → ~570 KB; no warning (the limit stays at 800 KB because React, Radix and Recharts alone exceed Vite's 500 KB default).
- The app no longer works from `file://` or fully offline with zero setup; it needs the static file next to it, which Pages and the dev server provide.
- Tests import the sample from `public/sample/` directly.
