# 0010. Metrics stay pure and shareable; report author is free text

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** Iteration plan

## Context
The backend's nightly snapshot job must compute exactly the same numbers as the browser, and sign-in doesn't exist yet.

## Decision
Every number stays in pure functions in `src/lib/jira/` with unit tests; components only display. The backend will move that folder into a shared package. A report's author is a single free-text field until sign-in exists.

## Consequences
- No metric logic in components or hooks beyond selecting inputs.
- The author field becomes a user id later without changing the report's shape beyond that one field.
