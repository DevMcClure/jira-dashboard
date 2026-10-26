# 0022. Flow Time boundaries and the start-point switch

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** Flow refinements (after F2)

## Context
The DX article on flow metrics (getdx.com/blog/flow-metrics) says Flow Time's start and end points must be defined and applied consistently. It measures "from approval to production", with approval usually meaning entry into the backlog. The Flow page's headline used cycle time (work started → done) and didn't say so.

## Decision
- The Flow page has a **"From created" / "From work started"** switch. It defaults to **From created** (lead time), matching the article. Both run to the item's last move into Done.
- The choice is a per-viewer preference.
- The KPI tile, the weekly trend, the per-item scatter, the WIP experiment tooltips and the team table all follow it.
- The **aging chart always measures from work started** and compares against **cycle-time** percentiles, so age and the lines it's compared with share a start point.
- The ticket sheet shows both figures. The Markdown report lists both, labelled with their start and end points.
- "How these are measured" on the page spells out every metric's boundaries.

## Consequences
- Flow Time from created includes backlog wait, so it reads longer than cycle time; teams compare like with like by keeping the switch fixed.
- This supersedes the Flow Time part of decision 0015 (percentile method and working-day length still stand).
