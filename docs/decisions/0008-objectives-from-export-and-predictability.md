# 0008. PI objectives come from the export; predictability formula

- **Status:** Accepted (source answered 26 Oct 2026)
- **Date:** 26 Oct 2026
- **Phase:** Iteration plan

## Context
F1 adds PI objectives with progress rolled up from epics and tickets. Where objectives live in the real tooling (a Jira issue type, Jira Align, Confluence, a spreadsheet) isn't known yet.

## Decision
Objectives are read from the export, extending the PI's `objectives[]` to objects (`id`, `piId`, `teamId` or null for ART level, `title`, `committed`, planned / actual business value 1–10, `epicKeys[]`, optional `issueKeys[]`). The contract stays lenient, so older exports with plain-string objectives still load. **PI predictability** = Σ actual BV ÷ Σ planned BV of committed objectives; uncommitted objectives add to actual only, so it can exceed 100%.

## Consequences
- **Answered 26 Oct 2026: objectives are a Jira issue type, linked to their epics.** The expanded Trawler should export those issues, and `trawler.ts` maps them into `programIncrements[].objectives`. The contract above doesn't change. To write that mapping we need, from the real Jira:
  - the objective issue type's name
  - how an objective is tied to its PI (fix version, a custom field, or a label)
  - the custom fields for committed / uncommitted and planned / actual business value
  - how epics are linked (issue links and their type, or the epics' parent)
  - whether an objective is team-level (its project) or ART-level
- Until the Trawler exports them, Objectives and Flow Predictability show empty states with real data.
