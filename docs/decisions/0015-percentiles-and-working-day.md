# 0015. Nearest-rank percentiles; a working day is 9 hours

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F2

## Context
Flow Time is reported as the 50th, 85th and 95th percentiles. There are several percentile definitions, and durations in working time need a unit that people can read.

## Decision
- Percentiles use **nearest rank**: the smallest finished time with at least p% of items at or below it. For example, "85% of items finished within 7.8 working days".
- Durations display in days. A **working day is one working-hours window (9 h)** and a calendar day is 24 h.
- Velocity counts an item in the week it **first** reached done. Cycle time runs from its **first** move into an active status (or into waiting if never active) to its **last** move into done.

## Consequences
- With few items, percentiles jump between actual values instead of interpolating, which is honest for small teams.
- Flow time in working days and in calendar days aren't comparable, so every chart carries a clock badge.
