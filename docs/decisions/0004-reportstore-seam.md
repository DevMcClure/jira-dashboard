# 0004. `ReportStore` seam

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F0

## Context
F3 saves configured dashboard views as named reports. Today they can only live in the browser; later they move to MongoDB with recipients and access control.

## Decision
Reports are saved only through `ReportStore<C>` (`src/lib/reports/report-store.ts`): `list`, `get`, `save`, `remove`, all async, generic over the config type. The browser implementation is `createLocalReportStore`: one JSON array under `jira-dashboard:reports`, each entry validated with a `parse` function on read (invalid entries are dropped), storage errors surfaced as rejected promises. Sharing is by link (F3).

## Consequences
- `ApiReportStore` fits behind the same interface later.
- A report saved in one browser isn't visible in another until the backend exists; links cover sharing meanwhile.
- Saving rewrites the array without entries that failed to parse, so a report from a newer schema version would be lost if saved over by an older app. Acceptable while there is one version; revisit when `schemaVersion` changes.
