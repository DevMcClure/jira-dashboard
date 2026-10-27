import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { historyDayLabel, type HistoryRow } from "@/lib/data/history-series"
import { HistoryChartCard } from "./HistoryChartCard"

// Same colours as the dashboard's burndown.
const config = {
  remaining: { label: "Remaining", color: "var(--chart-1)" },
  ideal: { label: "Ideal", color: "var(--muted-foreground)" },
} satisfies ChartConfig

/** Each day's burndown point, as stored: the line restarts with each sprint and breaks between them. */
export function RemainingHistoryChart({ rows }: { rows: HistoryRow[] }) {
  const empty = rows.every((r) => r.remaining === null) && "No sprint was running on the stored days."
  return (
    <HistoryChartCard title="Points remaining" description="The sprint burndown at the end of each day, against the ideal line." empty={empty}>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <ChartTooltip
            cursor={{ strokeWidth: 1 }}
            content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => historyDayLabel(p?.[0]?.payload as HistoryRow | undefined)} />}
          />
          <Line dataKey="ideal" type="linear" stroke="var(--color-ideal)" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={false} isAnimationActive={false} />
          <Line
            dataKey="remaining"
            type="linear"
            stroke="var(--color-remaining)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </LineChart>
      </ChartContainer>
    </HistoryChartCard>
  )
}
