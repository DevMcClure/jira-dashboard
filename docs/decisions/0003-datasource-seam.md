# 0003. `DataSource` seam

- **Status:** Accepted
- **Date:** 26 Oct 2026
- **Phase:** F0

## Context
Today data comes from the sample file plus uploads. The backend iteration adds live data from the Trawler feed. Pages shouldn't change when that happens.

## Decision
`DataProvider` talks only to a `DataSource` interface (`src/lib/data/data-source.ts`): `load()`, `loadFile(file)`, `reset()`, all async. Today's behaviour is `createStaticDataSource` (sample fetch + uploads remembered in `localStorage`). The provider takes an optional `dataSource` prop; the default is the static one. The old `DataSource` union type (sample / upload) is renamed `DataOrigin`.

## Consequences
- An `ApiDataSource` can be dropped in later; the context value pages read is unchanged.
- Parsing still goes through `src/lib/jira/adapter.ts`; a source only fetches and stores text.
- Sources take injected `fetch` / storage so they're unit-tested without a browser.
