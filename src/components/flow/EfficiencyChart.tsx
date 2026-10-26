import { format } from "date-fns"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { flowEfficiency } from "@/lib/jira/flow"
import type { TimeMode } from "@/lib/jira/working-time"
import { FlowChartCard } from "./FlowChartCard"

type Props = { efficiency: ReturnType<typeof flowEfficiency>; mode: TimeMode; windowLabel: string }

const config = { pct: { label: "Efficiency", color: "var(--chart-1)" } } satisfies ChartConfig

/** Flow efficiency per week of finishing: active ÷ (active + waiting) time of the items finished that week. */
export function EfficiencyChart({ efficiency, mode, windowLabel }: Props) {
  const data = efficiency.perWeek.map((w) => ({ week: format(w.week, "d MMM"), pct: w.pct, items: w.items }))
  return (
    <FlowChartCard
      title="Flow efficiency"
      description={`Share of cycle time spent actively worked, by finish week, ${windowLabel}: ${
        efficiency.pct === null ? "—" : `${efficiency.pct}%`
      } overall. Under 50% is normal.`}
      mode={mode}
      empty={efficiency.pct === null && "Nothing finished in this window."}
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={44} unit="%" />
          <ChartTooltip
            cursor={{ strokeWidth: 1 }}
            content={<ChartTooltipContent labelFormatter={(w) => `Finished week of ${w}`} formatter={(v) => `${v}%`} />}
          />
          <Line
            dataKey="pct"
            type="linear"
            stroke="var(--color-pct)"
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--color-pct)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
