import { format } from "date-fns"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { WeekCount } from "@/lib/jira/flow"
import { FlowChartCard } from "./FlowChartCard"

const config = { count: { label: "Finished", color: "var(--chart-1)" } } satisfies ChartConfig

/** Flow velocity: items finished per week (first time they reached done). */
export function ThroughputChart({ perWeek, windowLabel }: { perWeek: WeekCount[]; windowLabel: string }) {
  const data = perWeek.map((w) => ({ week: format(w.week, "d MMM"), count: w.count }))
  return (
    <FlowChartCard
      title="Throughput"
      description={`Items finished each week (week starting), ${windowLabel}.`}
      mode="count"
      empty={perWeek.every((w) => w.count === 0) && "Nothing finished in this window."}
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent labelFormatter={(w) => `Week of ${w}`} />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
