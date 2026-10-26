# 0023. History levels and sample-size warnings

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** Flow refinements (after F2)

## Context
The article says most teams see initial insights within 2–4 weeks of consistent measurement, with actionable patterns after 2–3 months. Percentiles over a handful of items are also easy to over-read.

## Decision
- A **history meter** in the Flow header shows whole weeks since the earliest flow start among the items in scope, as a level:
  - under 2 weeks: **Too early**
  - 2–8: **Early insights**
  - 8–13: **Patterns emerging**
  - 13 or more: **Established**
- Every percentile shows its **n**:
  - under 10 finished items warns "percentiles are rough"
  - under 20 warns about the 95th percentile
- The report repeats both.
- Weekly buckets use calendar weeks (date-fns `eachWeekOfInterval`). Fixed 7×24 h steps put items in the wrong week, or dropped them, across a clock change in the viewer's time zone; a test runs in Europe/London to guard it.

## Consequences
- In current-sprint scope the meter counts the current PI's items, so it usually reads "Early insights" or "Patterns emerging". A whole closed PI reads "Established".
