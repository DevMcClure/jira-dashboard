import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { flowDistribution } from "@/lib/jira/flow"
import { FLOW_TYPES } from "@/lib/jira/flowConfig"
import { FlowChartCard } from "./FlowChartCard"

/** Fixed order and colours (validated categorical palette in index.css); "Other" is neutral. */
const config = {
  Feature: { label: "Feature", color: "var(--flow-feature)" },
  Defect: { label: "Defect", color: "var(--flow-defect)" },
  Risk: { label: "Risk", color: "var(--flow-risk)" },
  Debt: { label: "Debt", color: "var(--flow-debt)" },
  Other: { label: "Other", color: "var(--flow-other)" },
} satisfies ChartConfig

type Props = { perSprint: ReturnType<typeof flowDistribution>["perSprint"] }

/** Flow distribution: the mix of item types finished in each sprint. */
export function DistributionChart({ perSprint }: Props) {
  const data = perSprint.map((s) => ({ sprint: s.name, ...s.counts }))
  return (
    <FlowChartCard
      title="Distribution"
      description="Items finished in each sprint, by flow type. Task and Spike count as Debt or Risk only when labelled tech-debt or risk."
      mode="count"
      empty={perSprint.length === 0 && "No started sprints in scope."}
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="sprint" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent />} />
          {FLOW_TYPES.map((t, i) => (
            <Bar
              key={t}
              dataKey={t}
              stackId="type"
              fill={`var(--color-${t})`}
              stroke="var(--card)"
              strokeWidth={1}
              radius={i === FLOW_TYPES.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
              isAnimationActive={false}
            />
          ))}
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
