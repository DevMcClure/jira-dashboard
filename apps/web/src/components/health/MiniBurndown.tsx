import { format } from "date-fns"
import { useId } from "react"
import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoad } from "@/hooks/useFirstLoad"
import type { BurndownPoint } from "@jira-dashboard/core/metrics"

const config = {
  remaining: { label: "Remaining", color: "var(--chart-1)" },
  ideal: { label: "Ideal", color: "var(--muted-foreground)" },
} satisfies ChartConfig

/** Compact burndown (no axes) for health cards; hover for values. */
export function MiniBurndown({ points }: { points: BurndownPoint[] }) {
  const id = useId().replace(/:/g, "")
  const loading = useFirstLoad()
  if (loading) return <Skeleton className="h-24 w-full" />
  if (points.length < 2) return null
  const data = points.map((p) => ({ day: format(p.date, "d MMM"), ideal: p.ideal, remaining: p.remaining }))
  return (
    <ChartContainer config={config} className="aspect-auto h-24 w-full">
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`mini-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-remaining)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-remaining)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" hide />
        <YAxis hide domain={[0, "dataMax"]} />
        <ChartTooltip cursor={{ strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="remaining"
          type="linear"
          stroke="var(--color-remaining)"
          strokeWidth={2}
          fill={`url(#mini-${id})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          isAnimationActive={false}
        />
        <Line
          dataKey="ideal"
          type="linear"
          stroke="var(--color-ideal)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
