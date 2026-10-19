import { format } from "date-fns"
import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { EmptyState } from "@/components/common/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { useStatusSeries } from "@/hooks/useStatusSeries"
import { cumulativeFlow } from "@/lib/jira/metrics"
import type { DateRange, Issue } from "@/lib/jira/types"

/**
 * The showpiece: tickets in each status at the end of every day, stacked.
 * Done sits at the bottom so the "work finished" band grows upward over time.
 */
export function CumulativeFlowChart({ issues, range }: { issues: Issue[]; range: DateRange }) {
  const { series, config } = useStatusSeries()
  const data = useMemo(
    () =>
      cumulativeFlow(issues, range).map((row) => ({
        day: format(row.date, "d MMM"),
        ...Object.fromEntries(series.map((s) => [s.key, row.counts[s.status] ?? 0])),
      })),
    [issues, range, series],
  )
  // Bottom-to-top stacking order = reverse workflow (Done first).
  const stacked = [...series].reverse()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumulative flow</CardTitle>
        <CardDescription>
          Tickets in each status at the end of every day. Widening bands show where work is piling up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {issues.length === 0 || data.length === 0 ? (
          <EmptyState className="h-80">No tickets for the current filters.</EmptyState>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-80 w-full">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`cfd-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.75} />
                    <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0.35} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <ChartTooltip
                cursor={{ strokeWidth: 1 }}
                content={<ChartTooltipContent indicator="dot" itemSorter={() => 0} />}
              />
              {stacked.map((s) => (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  stackId="cfd"
                  type="monotone"
                  stroke={`var(--color-${s.key})`}
                  strokeWidth={1.5}
                  fill={`url(#cfd-${s.key})`}
                  isAnimationActive={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
