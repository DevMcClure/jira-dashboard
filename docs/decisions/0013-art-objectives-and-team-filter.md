# 0013. ART-level objectives always show; team filters narrow their rollup

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F1

## Context
Objectives can belong to a team or to the whole ART (`teamId` null). When the header's team filter is set, hiding ART objectives would lose train-level commitments that the team contributes to.

## Decision
A team filter hides other teams' objectives, but **ART-level objectives always show**, with their rollup narrowed to the selected teams' tickets. An objective whose `teamId` isn't a known team is treated as ART level. Plain-string objectives from older exports become ART-level committed objectives with no links (so they show "No tickets").

## Consequences
- With a team filter on, an ART objective's % shows that team's share of the work, not the whole train's.
- Older exports keep loading; their objectives appear but have nothing to roll up until they gain `epicKeys`.
