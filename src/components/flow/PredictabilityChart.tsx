import { Bar, BarChart, CartesianGrid, LabelList, ReferenceArea, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { flowPredictability } from "@/lib/jira/flow"
import { FlowChartCard } from "./FlowChartCard"

const config = { pct: { label: "Predictability", color: "var(--chart-1)" } } satisfies ChartConfig

/** Flow predictability per PI (actual ÷ planned business value), with SAFe's 80–100% target band. */
export function PredictabilityChart({ rows }: { rows: ReturnType<typeof flowPredictability> }) {
  const data = rows.map((r) => ({ pi: r.pct === null ? `${r.name} (pending)` : r.name, pct: r.pct }))
  const max = Math.max(120, ...rows.map((r) => r.pct ?? 0))
  return (
    <FlowChartCard
      title="Predictability"
      description="Actual ÷ planned business value of committed objectives, per PI. The band is the 80–100% target; a PI is assessed when it ends."
      mode="count"
      empty={rows.length === 0 && "This export has no PIs."}
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid vertical={false} />
          <ReferenceArea y1={80} y2={100} fill="var(--muted-foreground)" fillOpacity={0.1} ifOverflow="extendDomain" />
          <XAxis dataKey="pi" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis domain={[0, max]} tickLine={false} axisLine={false} width={44} unit="%" />
          <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
          <Bar dataKey="pct" fill="var(--color-pct)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            <LabelList dataKey="pct" position="top" formatter={(v: unknown) => (v == null ? "" : `${v}%`)} className="fill-foreground text-xs" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
