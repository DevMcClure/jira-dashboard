# 0020. Downloading an export also saves a frozen report

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F3

## Context
The plan says "Saving a Markdown export also saves a frozen report", so a downloaded report can always be reopened as the exact dashboard it came from.

## Decision
- **Download .md** on the Export page saves a frozen report of the export's options: scope, teams, sprints, and the period pinned to its dates.
- It uses the default pages (Overview, Details, PI, Objectives, Flow, minus PI pages when the data has none). The title is the Markdown title plus the data date.
- The toast says so. If storage is blocked, the download still happens and the toast explains.
- The Export page also has **Save as report**, prefilled from its options.
- The author's name in the save dialog is remembered per viewer in `localStorage`, as a convenience. It stays a single free-text field (decision 0010).

## Consequences
- Frequent exporters accumulate frozen reports in My Reports, and can delete them from the sidebar menu.
- Export has no assignee filter, so these reports never filter by assignee.
