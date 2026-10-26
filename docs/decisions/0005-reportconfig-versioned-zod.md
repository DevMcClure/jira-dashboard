# 0005. `ReportConfig` is a versioned zod schema

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** Iteration plan

## Context
A report's configuration travels through `localStorage`, URLs (`/r?c=<base64url>`) and later the server. Links can be old or tampered with.

## Decision
`ReportConfig` is a zod schema with `schemaVersion: 1`, validated on every read and every opened link. The same object is stored unchanged everywhere: locally, in links, and in the backend's `reports` collection.

## Consequences
- An invalid or tampered link shows a toast and falls back to the normal dashboard.
- Changing the shape means bumping `schemaVersion` and adding a migration, not editing v1 in place.
