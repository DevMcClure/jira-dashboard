# 0018. Report URLs: /reports/:id, and /r?c= links that carry the report

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F3

## Context
Report mode reuses the normal pages under a report's config. A saved report lives in one browser's storage, but its link must work in any browser, including a private window, with no server.

## Decision
- **Saved reports** live at `/reports/<id>/<page>`, loaded from the `ReportStore`.
- **The shareable link** is `/r?c=<code>`. The code is the whole `ReportConfig` as UTF-8 JSON in base64url, validated with zod on open. That entry point redirects to `/r/<code>/<landing page>`, so in-report navigation keeps the code in the path and a refresh still works.
- A report's pages are the normal page routes, filtered to the report's `pages`, under that base path. Links inside pages go through `useAppPath()`, so they stay inside the report. A page that isn't in the report shows "Not part of this report".
- An invalid, tampered or truncated link shows a toast and the normal dashboard. So does a saved id that isn't in this browser.

## Consequences
- Links are long (a few hundred characters) but self-contained, so deleting a saved report doesn't break links already shared.
- The backend can later add short links (`/r/<id>`) alongside these without changing the screens.
