# 0016. The Flow page's tickets and chart window

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F2

## Context
Flow metrics need history. In current-sprint scope, the other pages count only the active sprint's tickets, which would leave weekly charts nearly empty. Short periods like "Today" leave them empty too.

## Decision
- **Tickets**: those in the scope's PI sprints (the current PI in sprint scope, or the chosen PI), or the header's picked sprints. Team and assignee filters narrow them. Epics and Sub-tasks are excluded.
- **KPI row**: uses the header period, with velocity compared against the previous period of the same length.
- **Charts**: use the period too, but cover **at least the last 8 weeks** ending now. Each chart says "since <date>".
- The Markdown report's Flow section uses the same ticket set and always uses working hours.

## Consequences
- The KPI row and the charts can cover different windows on short periods; the descriptions say which.
- The working-hours / calendar toggle is a per-viewer preference remembered in the browser, defaulting to working hours. The ticket side sheet follows it.
