# 0011. An objective's rollup counts its tickets in the PI's sprints

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F1

## Context
F1 rolls an objective's progress up from its epics' stories plus any directly linked issues. The plan doesn't say what to do with stories outside the PI, or with the Epic issues themselves. It also asks that scope, team and sprint filters update the rollups.

## Decision
An objective's tickets are the issues whose `epicKey` is in its `epicKeys`, plus those listed in `issueKeys`. **Epic-type issues are excluded**, and **only tickets in the PI's sprints count**.
- **Progress** is done points ÷ points in scope, falling back to ticket counts when nothing is estimated.
- **Filters**: the scope picks the PI. Team and assignee filters and picked sprints narrow the tickets counted. Predictability uses only the objectives shown, since business value isn't ticket-based.
- **Business value** is accepted as an integer 0–10. Anything else is read as "not set" rather than failing the load. 0 is allowed so an uncommitted objective can record that it delivered nothing.

## Consequences
- Stories of a linked epic that slip into the next PI stop counting towards this PI's objective. That's intended: the next PI owns them.
- The Objectives page, the objective burnup and the report's Objectives section use exactly the same rules.
