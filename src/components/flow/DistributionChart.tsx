import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
type View = "count" | "share"

/** Flow distribution: the mix of item types finished in each sprint, as counts or as each sprint's share. */
export function DistributionChart({ perSprint }: Props) {
  const [view, setView] = useState<View>("count")
  const share = view === "share"
  const data = perSprint.map((s) => ({ sprint: s.name, total: s.total, ...s.counts }))
  return (
    <FlowChartCard
      title="Distribution per sprint"
      description={`Items finished in each sprint by flow type, ${share ? "as a share of the sprint" : "as counts"}. Task and Spike count as Debt or Risk only when labelled tech-debt or risk.`}
      mode="count"
      empty={perSprint.length === 0 && "No started sprints in scope."}
      actions={
        <ToggleGroup type="single" size="sm" variant="outline" value={view} onValueChange={(v) => v && setView(v as View)} aria-label="Show as">
          <ToggleGroupItem value="count" className="h-6 px-2 text-xs">
            Count
          </ToggleGroupItem>
          <ToggleGroupItem value="share" className="h-6 px-2 text-xs">
            Share
          </ToggleGroupItem>
        </ToggleGroup>
      }
      hint={share ? "Share view hides volume, so a quiet sprint and a busy one look alike. Switch to Count to compare volume." : undefined}
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart
          data={data}
          margin={{ top: 8, right: 0, left: -20, bottom: 0 }}
          barCategoryGap="20%"
          stackOffset={share ? "expand" : "none"}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="sprint" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={share}
            width={44}
            tickFormatter={(v: number) => (share ? `${Math.round(v * 100)}%` : String(v))}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.4 }}
            content={
              <ChartTooltipContent
                formatter={(v, name, item) => {
                  const total = (item?.payload as { total?: number } | undefined)?.total ?? 0
                  const n = Number(v)
                  return `${config[name as keyof typeof config]?.label ?? name}: ${n}${total ? ` (${Math.round((n / total) * 100)}%)` : ""}`
                }}
              />
            }
          />
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
