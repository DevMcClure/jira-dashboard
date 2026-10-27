import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
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
import { transitionsPerDay, type Bucket } from "@jira-dashboard/core/metrics"
import type { DateRange, Transition } from "@jira-dashboard/core/types"
import { bucketLabel } from "./bucket-label"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoad } from "@/hooks/useFirstLoad"

type Props = { transitions: Transition[]; range: DateRange; bucket: Bucket }

/** Status changes per day (or hour), stacked by the status tickets moved into. */
export function TransitionsPerDayChart({ transitions, range, bucket }: Props) {
  const { series, config } = useStatusSeries()
  // Only statuses tickets actually move into (To Do rarely is one).
  const used = useMemo(() => series.filter((s) => transitions.some((t) => t.to === s.status)), [series, transitions])
  const data = useMemo(
    () =>
      transitionsPerDay(transitions, range, bucket).map((row) => ({
        day: bucketLabel(row.date, bucket),
        ...Object.fromEntries(used.map((s) => [s.key, row.counts[s.status] ?? 0])),
      })),
    [transitions, range, bucket, used],
  )
  const loading = useFirstLoad()
  const total = transitions.filter((t) => t.at >= range.start && t.at <= range.end).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transitions per {bucket}</CardTitle>
        <CardDescription className="tabular-nums">
          {total} status changes, by destination status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : total === 0 ? (
          <EmptyState className="h-56">No movement in this period.</EmptyState>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-56 w-full">
            <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              {used.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="t"
                  fill={`var(--color-${s.key})`}
                  stroke="var(--card)"
                  strokeWidth={1}
                  maxBarSize={24}
                  radius={i === used.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
