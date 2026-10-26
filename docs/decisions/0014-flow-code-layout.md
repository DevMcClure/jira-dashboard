# 0014. Flow metrics live in their own files

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F2

## Context
The plan puts the flow functions "in `metrics.ts`". That file was already 670 lines, and flow needs its own settings and timezone-aware time maths.

## Decision
- The flow functions live in **`src/lib/jira/flow.ts`**.
- Settings live in **`flowConfig.ts`**: status → flow state, Jira type → flow type, label overrides, excluded types and working hours.
- Time maths lives in **`working-time.ts`**.
- All three are pure, unit-tested, and sit in `src/lib/jira/`, so the rule that every number comes from a pure function there still holds. `flow.ts` reuses `statusAt` and `piPredictability` from `metrics.ts`.
- Working hours in Europe/London are computed with `Intl.DateTimeFormat` rather than a new dependency. Offsets are cached per hour and the daily windows per day, because uncached lookups made the Flow page take ~0.5 s.

## Consequences
- The backend's shared package takes the whole `src/lib/jira/` folder, flow included.
- The offset cache assumes clock changes happen on the hour, which is true for London and nearly every zone.
