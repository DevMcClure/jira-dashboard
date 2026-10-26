# 0001. Frontend-first, browser-only iteration

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** Iteration plan

## Context
The dashboard needs objectives, flow metrics and shareable reports. A backend is planned (server, Crowd auth, live Trawler feed, MongoDB), but the screens can be designed and validated without it, and the site must stay a free, public demo.

## Decision
Build this iteration entirely in the browser on mock data: no server calls, no auth, no database, no secrets, no real data. It keeps deploying to GitHub Pages exactly as today. Backend work follows in a separate iteration, behind interfaces put in place now (0003, 0004).

## Consequences
- Anything committed or bundled is public, so real company data is only ever uploaded, never committed.
- Saved reports live in one browser and are shared by link until the backend exists.
- Each seam is an interface with a browser-only implementation, so the backend replaces implementations rather than pages.
