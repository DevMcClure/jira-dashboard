import { format } from "date-fns"
import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { EmptyState } from "@/components/common/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { createdVsResolvedPerDay } from "@/lib/jira/metrics"
import type { DateRange, Issue } from "@/lib/jira/types"

const config = {
  created: { label: "Created", color: "var(--chart-2)" },
  resolved: { label: "Resolved", color: "var(--chart-1)" },
} satisfies ChartConfig

export function CreatedResolvedChart({ issues, range }: { issues: Issue[]; range: DateRange }) {
  const data = useMemo(
    () => createdVsResolvedPerDay(issues, range).map((r) => ({ ...r, day: format(r.date, "d MMM") })),
    [issues, range],
  )
  const totals = data.reduce((t, r) => ({ c: t.c + r.created, r: t.r + r.resolved }), { c: 0, r: 0 })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Created vs resolved</CardTitle>
        <CardDescription className="tabular-nums">
          {totals.c} created · {totals.r} resolved in this period
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState className="h-56" />
        ) : (
          <ChartContainer config={config} className="aspect-auto h-56 w-full">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <ChartTooltip cursor={{ strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" />} />
              <ChartLegend content={<ChartLegendContent />} />
              {(["created", "resolved"] as const).map((k) => (
                <Line
                  key={k}
                  dataKey={k}
                  type="monotone"
                  stroke={`var(--color-${k})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
