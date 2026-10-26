# 0017. Unknown statuses, WIP and the colour palette

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F2

## Context
Real Jira workflows have statuses the config doesn't list. The plan also leaves open what counts as work in progress, and the Distribution chart needs five categorical colours.

## Decision
- An unknown status maps by its category: to do → not started, in progress → **active**, done → done. To mark a status as waiting, add it to `flowConfig.ts`.
- **WIP** is items in an active *or* waiting state. Not-started items aren't WIP.
- Between an item's start and its last done, time in a not-started or done status counts as waiting. This covers reopened items and items moved back to To Do.
- A Bug labelled `tech-debt` stays a Defect, because the type map wins and labels only classify unmapped types.
- Flow types use new tokens `--flow-feature` (blue), `--flow-defect` (rose), `--flow-risk` (amber), `--flow-debt` (teal) and `--flow-other` (neutral). They were validated with the dataviz palette checks (lightness band, chroma, colour-blind and normal-vision separation, contrast) against the light card, and with separate steps against the dark card and page. Status colours stay reserved for statuses.

## Consequences
- Unmapped "waiting" statuses inflate efficiency until they're added to the config.
- Changing the flow palette means re-running the validator for both modes.
