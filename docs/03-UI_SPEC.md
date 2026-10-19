# 03 — UI Spec

The dashboard must look like it belongs to the owner's existing internal app ("Atlas Index"). That app is a **shadcn/ui sidebar layout, dark by default, neutral/zinc palette, rounded cards with subtle borders, uppercase small labels, and coloured status dots**. Match it, then make it more impressive with good charts — not with a different visual language.

## Reference app — what it looks like
- **Left sidebar** (shadcn `Sidebar`, ~256px, slightly lighter than the page background):
  - Top: an app/team switcher (logo square + app name + up/down chevrons `ChevronsUpDown`) — shadcn "team switcher" pattern.
  - Nav group label in small muted text ("Explore the Index"), items with lucide icons, active item has a filled rounded `bg-sidebar-accent` highlight.
  - A separator, then a second group ("About the System").
  - Footer: user row — avatar circle with initial, name ("Guest"), chevrons (shadcn "nav-user" pattern).
- **Header bar**: sidebar toggle icon, thin vertical separator, breadcrumb/page name. Right side: sun icon (theme toggle) and a small blue "A" logo mark.
- **Page body**: large page title (`text-2xl font-semibold`), one-line muted description beneath.
- **Stat cards row**: three equal cards. Inside: uppercase small label (`text-xs font-medium tracking-wide uppercase text-muted-foreground`), a big number (`text-3xl font-semibold`), a small delta line ("+1 this week").
- **Lower row**: a wide card containing a table with uppercase column headers (left, ~2/3), and a narrow card list on the right ("SERVICE STATUS") where each row is: coloured dot (teal = good, amber = syncing/warn, red = error) + bold name + muted one-line status. Rows divided by borders.
- Empty table state: centred "No results." in muted text.

## Our app — Shell
- App switcher label: **"Sprint Atlas"** with subtitle "Jira insights". Logo: a lucide `Orbit` or `Layers` icon in a `bg-primary` rounded square.
- Sidebar groups and items (lucide icons):
  - **Explore the Sprints**: Overview (`LayoutGrid`), Tickets (`Ticket`), Sprints (`Timer`), Teams (`Users`), People (`User`), Movements (`ArrowRightLeft`)
  - **About the Data**: Import (`Upload`), About (`Info`)
- Sidebar footer: user row "Guest" with avatar initial "G" (static, no auth).
- Under the switcher, show a small muted "Data: sample · generated 19 Oct 2026" line (or the uploaded filename) — collapses away in icon mode.
- Header right side, in this order: **global filter bar** (three compact multi-select popovers: Sprints, Teams, Assignees — show "All" or a count badge), theme toggle (`Sun`/`Moon` ghost icon button), logo mark.
- Sidebar collapsible to icons; tooltips show item names when collapsed.

## Theme tokens
Use shadcn's default neutral dark theme as the base. Add to `src/index.css` (both `:root` and `.dark`):
```css
--status-todo:     /* slate-400 */
--status-progress: /* blue-500 */
--status-review:   /* violet-500 */
--status-blocked:  /* red-500 */
--status-qa:       /* amber-400 */
--status-done:     /* teal-400 — matches the reference's green dots */
--chart-1 … --chart-5  /* teal, blue, violet, amber, rose */
```
Optional subtle flourish (keeps the reference's feel): a very faint radial gradient glow behind the top of the main content in dark mode (`bg-[radial-gradient(...)]` at ~6% opacity). Don't overdo it.

Card style everywhere: shadcn `Card`, `rounded-xl`, default border, `bg-card`. Spacing: page padding `p-6`, gaps `gap-4`. Max content width none (full width like the reference).

## Overview page
Title **"Overview"**, description: *"Current totals, sprint progress and recent ticket movement across the selected teams and sprints."*

Grid (desktop):
```
[ TOTAL TICKETS ][ REMAINING ][ COMPLETED ][ BLOCKED ]            ← 4 StatCards
[ Sprint burndown (area chart, 2/3)        ][ Status (donut 1/3) ]
[ Recent movements (table, 2/3)            ][ Sprint health (1/3)]
[ Tickets by assignee (horizontal bars, full width or 1/2) ]
```
- **StatCard** = reference card exactly: uppercase label, big number, delta line. Delta in muted text with a small coloured arrow (`TrendingUp`/`TrendingDown`), e.g. "+12 created this week", "−18 points this week", "+9 done this week", "2 new blockers". Add a tiny sparkline (last 14 days) aligned bottom-right for the impressive touch.
- **Burndown**: two series — "Ideal" (dashed, muted) and "Remaining" (filled area, `--chart-1` gradient). Card header has a sprint `Select` defaulting to the active sprint. Show a vertical reference line at "today" (`meta.generatedAt`).
- **Status donut**: shadcn radial/pie chart with total in the centre and a legend using the status colour tokens.
- **Recent movements table**: columns `TICKET` (key in mono + truncated summary), `MOVEMENT` (from-badge → to-badge, badges coloured by status), `BY` (avatar + name), `WHEN` (relative, e.g. "3h ago", tooltip with exact date). Uppercase headers as in reference. "View all" link to `/movements`.
- **Sprint health card**: title "SPRINT HEALTH" (uppercase like "SERVICE STATUS"). One row per sprint in scope: dot (teal on track / amber at risk / red off track / muted completed) + bold sprint name + muted line ("On track · 62% done · 4 days left"). Rows separated by borders — copy the reference layout.

## Other pages (keep consistent)
Every page: `PageHeader` (title + description) → content in Cards.
- **Tickets**: shadcn data-table pattern. Status `Badge` with a leading coloured dot. Type and priority as small lucide icons with tooltips. Keys in `font-mono`. Ticket detail `Sheet` (width ~ 560px) with a vertical timeline: dot per event, coloured by destination status, text "Moved **In Review → QA** by Priya · 2 days in Review", relative date on the right.
- **Sprints**: responsive grid of sprint cards; state badge (Active = teal outline, Closed = muted, Future = blue outline); `Progress` bar; mini status counts row.
- **Teams / People**: cards with avatar stacks and compact bar charts.
- **Movements**: chart cards first (cumulative flow full width — stacked areas using status colours, smooth curves, gradient fills; this is the showpiece), then created vs resolved + transitions/day side by side, then the full transitions table.
- **Import**: large dashed-border drop zone (`border-dashed rounded-xl`, icon `UploadCloud`, "Drop a Jira Trawler JSON export here or browse"), summary card after load.

## Quality bar
- No layout shift on load; skeletons match final card sizes.
- All numbers use `tabular-nums`.
- Charts: tooltips on, gridlines subtle (`stroke-muted`), no chart junk, axis labels small and muted.
- Works and looks right in **light mode** too (tokens handle it).
- Responsive: KPI row 4 → 2 columns under `lg`; two-column rows stack under `lg`.