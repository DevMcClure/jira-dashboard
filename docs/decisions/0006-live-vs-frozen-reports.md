# 0006. Live and frozen reports; new reports default to live

- **Status:** Accepted (confirmed 26 Oct 2026)
- **Date:** 26 Oct 2026
- **Phase:** Iteration plan

## Context
A report can either re-apply its filters to whatever data is loaded (useful for a standing "team status" view), or pin exactly what the author saw.

## Decision
Two kinds: **live** (filters re-applied, period stays relative such as "last 7 days") and **frozen** (period pinned to absolute dates, with the export's `generatedAt` recorded as `dataStamp`). Saving a Markdown export also saves a frozen report. New reports default to **live**; frozen is one click away. When the loaded data's `generatedAt` differs from a report's `dataStamp`, the banner says so.

## Consequences
- Live reports can drift from what the author saw; the banner's as-of time makes that visible.
- Confirmed on 26 Oct 2026: new reports stay live by default.
