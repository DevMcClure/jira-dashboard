import { format } from "date-fns"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { flowLoad } from "@jira-dashboard/core/flow"
import { FlowChartCard } from "./FlowChartCard"

const config = {
  active: { label: "Active", color: "var(--status-progress)" },
  waiting: { label: "Waiting", color: "var(--status-review)" },
} satisfies ChartConfig

/** Flow load: items in progress at the end of each day, split into active and waiting. */
export function WipChart({ daily, windowLabel }: { daily: ReturnType<typeof flowLoad>["daily"]; windowLabel: string }) {
  const data = daily.map((d) => ({ day: format(d.date, "d MMM"), active: d.active, waiting: d.waiting }))
  return (
    <FlowChartCard
      title="Work in progress"
      description={`Items in an active or waiting status at the end of each day, ${windowLabel}.`}
      mode="count"
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <ChartTooltip cursor={{ strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" />} />
          {(["active", "waiting"] as const).map((k) => (
            <Area
              key={k}
              dataKey={k}
              stackId="wip"
              type="linear"
              stroke={`var(--color-${k})`}
              strokeWidth={2}
              fill={`var(--color-${k})`}
              fillOpacity={0.2}
              isAnimationActive={false}
            />
          ))}
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
