import { format } from "date-fns"
import { useMemo } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoad } from "@/hooks/useFirstLoad"
import { piBurnup } from "@/lib/jira/metrics"
import type { Issue, ProgramIncrement, Sprint } from "@/lib/jira/types"

const config = {
  done: { label: "Done", color: "var(--chart-1)" },
  scope: { label: "Scope", color: "var(--muted-foreground)" },
} satisfies ChartConfig

const DAY_FMT = "d MMM"

type Props = { pi: ProgramIncrement; sprints: Sprint[]; issues: Issue[]; now: Date }

/** Points done vs total scope, day by day across the PI, with sprint boundaries. */
export function PiBurnupChart({ pi, sprints, issues, now }: Props) {
  const loading = useFirstLoad()
  const data = useMemo(
    () => piBurnup(pi, issues, now).map((p) => ({ day: format(p.date, DAY_FMT), scope: p.scope, done: p.done })),
    [pi, issues, now],
  )
  const today = format(now, DAY_FMT)
  const showToday = pi.state === "active" && data.some((d) => d.day === today)
  // One boundary per sprint slot (all teams share the calendar).
  const boundaries = [...new Set(sprints.slice(1).map((s) => s.startDate && format(s.startDate, DAY_FMT)))].filter(
    (d): d is string => !!d && d !== data[0]?.day,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>PI burnup</CardTitle>
        <CardDescription>Story points done against total scope. Dotted lines mark sprint starts.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="burnup-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-done)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-done)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <ChartTooltip cursor={{ strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" formatter={tooltipRow} />} />
              {boundaries.map((d) => (
                <ReferenceLine key={d} x={d} stroke="var(--border)" strokeDasharray="2 4" />
              ))}
              {showToday && (
                <ReferenceLine
                  x={today}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.6}
                  label={{ value: "Today", position: "insideTopLeft", fill: "var(--muted-foreground)", fontSize: 11 }}
                />
              )}
              <Area
                dataKey="done"
                type="linear"
                stroke="var(--color-done)"
                strokeWidth={2}
                fill="url(#burnup-fill)"
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              />
              <Line
                dataKey="scope"
                type="stepAfter"
                stroke="var(--color-scope)"
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
