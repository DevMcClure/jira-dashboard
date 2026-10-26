# 0009. No custom date range this iteration

- **Status:** Superseded by [0021](0021-custom-date-range.md) (answered 26 Oct 2026: add a custom range)
- **Date:** 26 Oct 2026
- **Phase:** Iteration plan

## Context
Frozen reports need fixed dates, and a custom range picker has been asked about.

## Decision
The period picker keeps its presets. A frozen report pins the chosen preset's resolved start and end dates.

## Consequences
- Users can't build a report for an arbitrary window yet.
- Open question: add a custom range now?
