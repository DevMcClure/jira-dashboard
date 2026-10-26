# 0012. Objectives with no tickets, and how the forecast works

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F1

## Context
Some objectives have nothing linked yet. The plan's forecast uses "the done rate over the last 10 working days", but working hours only arrive with F2's flow settings.

## Decision
- An objective with no linked tickets has health **"No tickets"** (`no_data`), not "on track", and no forecast.
- **Forecast** = % done now + (gain in % done over the last 10 working days, or since the PI started if that's sooner, ÷ those days) × working days left. It is capped at 100%. A negative gain counts as zero.
- Working days skip weekends only, using date-fns business-day helpers. There's no holiday calendar until F2's working-hours setting exists.
- A closed PI shows its final %, and a future PI has no forecast.

## Consequences
- Forecasts lean optimistic just before a holiday and pessimistic straight after one.
- When F2 adds working-hours settings, the forecast should switch to them. That's a one-function change in `metrics.ts`.
