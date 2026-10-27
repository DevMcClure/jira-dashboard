import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { historyDayLabel, type HistoryRow } from "@/lib/data/history-series"
import { HistoryChartCard } from "./HistoryChartCard"

type Props = {
  rows: HistoryRow[]
  metric: "wip" | "cycleTimeP85"
  title: string
  description: string
  /** Tooltip name, e.g. "Items" or "Working days". */
  unit: string
  empty: string
}

/** One flow number per day, as stored in the snapshots (single series: the title names it, no legend). */
export function MetricHistoryChart({ rows, metric, title, description, unit, empty }: Props) {
  const config = { [metric]: { label: unit, color: "var(--chart-2)" } } satisfies ChartConfig
  return (
    <HistoryChartCard title={title} description={description} empty={rows.every((r) => r[metric] === null) && empty}>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
          <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={metric !== "wip"} />
          <ChartTooltip cursor={{ strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => historyDayLabel(p?.[0]?.payload as HistoryRow | undefined)} />} />
          <Line
            dataKey={metric}
            type="linear"
            stroke={`var(--color-${metric})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </HistoryChartCard>
  )
}
