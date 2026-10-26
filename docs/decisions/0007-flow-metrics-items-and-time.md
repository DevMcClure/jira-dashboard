# 0007. Flow metrics count items and time; status mapping and working hours

- **Status:** Accepted (defaults until the open question is answered)
- **Date:** 26 Oct 2026
- **Phase:** Iteration plan

## Context
SAFe's six flow metrics measure items and elapsed time, not story points. Jira records statuses, not whether anyone was actively working, and nights and weekends would otherwise look like queue time.

## Decision
Flow metrics sit beside the points-based views and don't replace them. `src/lib/jira/flowConfig.ts` maps each status to `not-started` / `active` / `waiting` / `done` (defaults: To Do not-started; In Progress and QA active; In Review and Blocked waiting; Done done), maps Jira types to Feature / Defect / Risk / Debt / Other (Story and Epic → Feature, Bug → Defect, Task and Spike → Debt or Risk only when labelled `tech-debt` / `risk`, else Other), and sets working hours (Mon–Fri 09:00–18:00 Europe/London), which are the default. Flow Time is reported as 50th / 85th / 95th percentiles; efficiency is an aggregate over finished tickets; reopened tickets keep their first start and last done, with time in Done counting as waiting.

## Consequences
- Flow efficiency will usually read well under 50%; that's expected.
- Every flow chart states whether it uses working hours or calendar time.
- Open question: which real statuses count as waiting.
