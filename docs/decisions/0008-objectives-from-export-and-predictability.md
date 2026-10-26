# 0008. PI objectives come from the export; predictability formula

- **Status:** Accepted (default until the open question is answered)
- **Date:** 26 Oct 2026
- **Phase:** Iteration plan

## Context
F1 adds PI objectives with progress rolled up from epics and tickets. Where objectives live in the real tooling (a Jira issue type, Jira Align, Confluence, a spreadsheet) isn't known yet.

## Decision
Objectives are read from the export, extending the PI's `objectives[]` to objects (`id`, `piId`, `teamId` or null for ART level, `title`, `committed`, planned / actual business value 1–10, `epicKeys[]`, optional `issueKeys[]`). The contract stays lenient, so older exports with plain-string objectives still load. **PI predictability** = Σ actual BV ÷ Σ planned BV of committed objectives; uncommitted objectives add to actual only, so it can exceed 100%.

## Consequences
- The Trawler doesn't export objectives yet, so with real data Objectives and Flow Predictability show empty states.
- Open question: the real source of objectives.
