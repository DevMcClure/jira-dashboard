import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { sizeMix } from "@/lib/jira/flow"
import { FlowChartCard } from "./FlowChartCard"

const config = { count: { label: "Items", color: "var(--chart-1)" } } satisfies ChartConfig

type Props = { mix: ReturnType<typeof sizeMix>; periodPhrase: string }

/** Story-point sizes of finished items: velocity counts items regardless of size, so this shows whether size is shifting. */
export function SizeMixChart({ mix, periodPhrase }: Props) {
  const data = mix.buckets.filter((b) => b.count || !["Other", "Unestimated"].includes(b.size)).map((b) => ({ size: b.size, count: b.count }))
  const shift =
    mix.median !== null && mix.previousMedian !== null && mix.median !== mix.previousMedian
      ? ` Median ${mix.median} points, ${mix.median > mix.previousMedian ? "up" : "down"} from ${mix.previousMedian} in the previous period.`
      : mix.median !== null
        ? ` Median ${mix.median} points.`
        : ""
  return (
    <FlowChartCard
      title="Size of finished items"
      description={`Story points of items finished ${periodPhrase}.${shift}`}
      mode="count"
      empty={mix.finished === 0 && "Nothing finished in this window."}
      hint="Velocity counts items, not size. If velocity changes while the size mix shifts, the work changed, not necessarily the team's pace."
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="size" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent labelFormatter={(s) => (/^\d+$/.test(String(s)) ? `${s} points` : String(s))} />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
