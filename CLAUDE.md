# CLAUDE.md — Sprint Atlas (Jira Dashboard POC)

You are building a **proof-of-concept Jira sprint dashboard**. Read this file first, then follow the docs in order:

1. `docs/01-BUILD_PLAN.md` — the phased steps. Work through them in order and tick them off.
2. `docs/02-DATA_CONTRACT.md` — the JSON shape the dashboard consumes, plus the mock-data generator spec.
3. `docs/03-UI_SPEC.md` — the visual design. It must match the owner's existing app (shadcn sidebar layout, dark theme).

## What this is
- A React + shadcn/ui dashboard that reads a **JSON export of Jira data** (produced by a separate "Jira Trawler" script) and visualises it: ticket counts, remaining work, status, assignees, sprint progress, and ticket movement history (status transitions over time).
- For the POC the data comes from a **local mock JSON file** (`src/data/jira-export.json`). The user can also **drop in / upload a new JSON file** at runtime to mimic the real workflow.
- No backend. No API calls. No secrets. No auth.

## Tech stack (do not deviate)
| Concern | Choice |
|---|---|
| Build tool | Vite (latest) + React 18/19 + TypeScript (strict) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Components | shadcn/ui (init with the CLI, `new-york` style, `neutral` base colour, CSS variables on) |
| Charts | shadcn `chart` component (Recharts under the hood) |
| Tables | shadcn `table` + `@tanstack/react-table` (the shadcn "data table" pattern) |
| Icons | `lucide-react` |
| Routing | `react-router-dom` |
| Validation | `zod` (validate every loaded JSON file) |
| Dates | `date-fns` |
| Package manager | npm |

## Rules
- **Use shadcn components wherever one exists.** Add them with `npx shadcn@latest add <name>`. Don't hand-roll buttons, cards, badges, tables, sheets, tooltips, etc.
- **Theming via shadcn CSS variables only.** No hard-coded hex colours in components; add any extra tokens (status colours, chart colours) as CSS variables in `src/index.css`.
- **Dark mode is the default**, with a working light/dark toggle (top-right sun icon, like the reference app).
- **All data access goes through `src/lib/jira/`.** Components never read raw JSON directly. Raw JSON → `adapter.ts` → typed domain model → selectors/hooks. This is so the real Trawler output can be swapped in by changing only the adapter.
- **All derived numbers (counts, burndown, cycle time) are computed in pure functions in `src/lib/jira/metrics.ts`** with unit tests (Vitest).
- Keep components small; one component per file under `src/components/`.
- No secrets, no `.env` needed. If you think you need one, you don't — stop and ask.
- Don't add features outside the build plan without asking. This is a POC; polish over breadth.

## Commands
```bash
npm run dev          # start dev server
npm run build        # type-check + build
npm run test         # vitest
npm run lint         # eslint
npm run mock:data    # regenerate src/data/jira-export.json
```

## Definition of done
- `npm run build`, `npm run test` and `npm run lint` all pass with zero errors.
- Every page in the build plan renders with the mock data, in both dark and light mode, at 1440px and 1024px widths.
- Uploading an invalid JSON shows a friendly error (toast) and keeps the previous data.
- README explains how to run it and how to plug in a real Trawler export.