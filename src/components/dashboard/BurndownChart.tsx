import { format } from "date-fns"
import { useMemo } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"
import { EmptyState } from "@/components/common/EmptyState"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { useScopedSprints } from "@/hooks/useScopedSprints"
import { burndown, sprintHealth } from "@/lib/jira/metrics"
import type { Sprint } from "@/lib/jira/types"

const config = {
  remaining: { label: "Remaining", color: "var(--chart-1)" },
  ideal: { label: "Ideal", color: "var(--muted-foreground)" },
} satisfies ChartConfig

const DAY_FMT = "d MMM"

/** Default: the explicitly chosen sprint, else the first active one, else the latest. */
function pickSprint(sprints: Sprint[], chosen: number | null): Sprint | undefined {
  return (
    sprints.find((s) => s.id === chosen) ??
    sprints.find((s) => s.state === "active") ??
    sprints.filter((s) => s.state === "closed").at(-1)
  )
}

export function BurndownChart() {
  const { dataset, burndownSprintId, setBurndownSprintId } = useData()
  const issues = useFilteredIssues()
  const now = dataset.meta.generatedAt
  const scoped = useScopedSprints()
  const sprints = useMemo(() => scoped.filter((s) => s.state !== "future" && s.startDate && s.endDate), [scoped])
  const sprint = useMemo(() => pickSprint(sprints, burndownSprintId), [sprints, burndownSprintId])

  const { data, health, remaining } = useMemo(() => {
    if (!sprint) return { data: [], health: null, remaining: 0 }
    const points = burndown(sprint, issues, now)
    return {
      data: points.map((p) => ({ day: format(p.date, DAY_FMT), ideal: p.ideal, remaining: p.remaining })),
      health: sprintHealth(sprint, issues, now),
      remaining: points.findLast((p) => p.remaining !== null)?.remaining ?? 0,
    }
  }, [sprint, issues, now])

  const today = format(now, DAY_FMT)
  const showToday = sprint?.state === "active" && data.some((d) => d.day === today)
  const byTeam = groupByTeam(sprints, (id) => dataset.teamById.get(id)?.name)

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Sprint burndown</CardTitle>
        <CardDescription className="tabular-nums">
          {sprint && health
            ? `${remaining} pts remaining · ${health.pctDone}% done · ${
                sprint.state === "active" ? `ends ${format(sprint.endDate!, DAY_FMT)}` : "completed"
              }`
            : "Story points left in the sprint, day by day"}
        </CardDescription>
        {sprints.length > 0 && (
          <CardAction>
            <Select value={sprint ? String(sprint.id) : undefined} onValueChange={(v) => setBurndownSprintId(Number(v))}>
              <SelectTrigger size="sm" className="w-44" aria-label="Sprint">
                <SelectValue placeholder="Choose sprint" />
              </SelectTrigger>
              <SelectContent align="end">
                {byTeam.map(([team, list]) => (
                  <SelectGroup key={team}>
                    <SelectLabel>{team}</SelectLabel>
                    {list.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState className="h-64">No sprint data for the current filters.</EmptyState>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="burndown-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-remaining)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-remaining)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <ChartTooltip
                cursor={{ strokeWidth: 1 }}
                content={<ChartTooltipContent indicator="line" formatter={tooltipRow} />}
              />
              {showToday && (
                <ReferenceLine
                  x={today}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.6}
                  label={{ value: "Today", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
                />
              )}
              <Area
                dataKey="remaining"
                type="linear"
                stroke="var(--color-remaining)"
                strokeWidth={2}
                fill="url(#burndown-fill)"
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              />
              <Line
                dataKey="ideal"
                type="linear"
                stroke="var(--color-ideal)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function tooltipRow(value: unknown, name: unknown) {
  const label = config[name as keyof typeof config]?.label ?? String(name)
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2.5 w-1 rounded-[2px]" style={{ backgroundColor: `var(--color-${String(name)})` }} />
        {label}
      </span>
      <span className="font-mono font-medium text-foreground tabular-nums">{String(value)} pts</span>
    </div>
  )
}

function groupByTeam(sprints: Sprint[], teamName: (id: string) => string | undefined): [string, Sprint[]][] {
  const map = new Map<string, Sprint[]>()
  for (const s of sprints) {
    const team = (s.teamId && teamName(s.teamId)) || "Other"
    map.set(team, [...(map.get(team) ?? []), s])
  }
  return [...map.entries()]
}
