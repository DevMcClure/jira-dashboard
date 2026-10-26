# 0019. Report mode overrides the data context and locks it

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F3

## Context
The plan asks for the same pages to render under a report's config with filters locked, without duplicating pages.

## Decision
- `ReportModeProvider` wraps the pages in a nested `DataContext` whose `filters`, `scope`, `period` and new `fixedRange` come from the report.
- Their setters do nothing, which is what locks the filters. The header shows the controls disabled, with a lock icon.
- The user's own view in the outer `DataProvider` is never touched, so **Exit report** returns to it exactly as it was (the return path is kept in `sessionStorage`).
- **Explore from here** copies the report's filters, scope and period into the outer provider and leaves the report unchanged.
- Clicks that would normally set a filter, such as a sprint card on the Sprints page, still navigate, but the filter stays as the report defines it.
- If the loaded data doesn't contain the report's teams or sprints (different data), views are simply empty, and the banner's data-mismatch line explains why.

## Consequences
- No page knows about report mode, apart from links going through `useAppPath()`.
- A frozen report's pinned dates replace the period's range everywhere through `usePeriod()`.
