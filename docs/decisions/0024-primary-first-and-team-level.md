# 0024. Primary-first Flow layout, the WIP experiment, team level only

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** Flow refinements (after F2)

## Context
The article advises starting with Flow Time and Flow Load as the primary optimisation targets. It notes that metrics conflict (a velocity dip often comes with longer Flow Time) and that there's no universal right WIP level. Flow metrics describe a system, not individual performance.

## Decision
- The Flow page leads with **Flow Time and Flow Load** tiles, then **Flow time vs throughput**: weekly flow time above weekly throughput, on the same weeks. These are two charts with one axis each, never a dual axis.
- A **WIP vs throughput** scatter (one dot per week, with that week's flow time on hover) supports finding the WIP level by experiment.
- Velocity, efficiency, distribution and predictability follow as supporting metrics. Velocity is coloured neutral, not good or bad, because it counts items regardless of size; a size-of-finished-items chart sits beside it.
- Distribution shows the work in progress now next to what finished, plus a Count / Share toggle per sprint.
- A **team table** gives each team's flow (velocity, flow time, WIP, WIP per member, efficiency, mix). **There is no per-person flow view**, and the page and report say these are system measures, not for rating individuals.

## Consequences
- Anyone wanting per-person numbers has to go to People (workload), which is about load balancing, not flow.
- "What to look for" hints on each chart carry the article's interpretation advice.
