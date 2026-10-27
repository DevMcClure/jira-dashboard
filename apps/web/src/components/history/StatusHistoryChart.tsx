import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useStatusInfo } from "@/hooks/useStatusInfo"
import { historyDayLabel, type HistoryRow } from "@/lib/data/history-series"
import { HistoryChartCard } from "./HistoryChartCard"

/** Tickets in the day's sprint by status, stacked in workflow order. Status colours as everywhere else. */
export function StatusHistoryChart({ rows, statuses }: { rows: HistoryRow[]; statuses: string[] }) {
  const info = useStatusInfo()
  // Recharts keys can't contain spaces; s0, s1, … stand in for the status names.
  const keys = statuses.map((_, i) => `s${i}`)
  const config = useMemo(
    () => Object.fromEntries(statuses.map((s, i) => [keys[i], { label: s, color: `var(${info(s).colorVar})` }])) satisfies ChartConfig,
    [statuses, keys, info],
  )
  const data = rows.map((r) => ({
    row: r,
    label: r.label,
    ...Object.fromEntries(statuses.map((s, i) => [keys[i], r.missing || !r.sprint ? null : (r.statusCounts[s] ?? 0)])),
  }))
  const empty = !statuses.length && "No tickets on the stored days."
  return (
    <HistoryChartCard title="Tickets by status" description="The sprint's tickets in each status at the end of each day." empty={empty}>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <ChartTooltip cursor={{ strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => historyDayLabel(p?.[0]?.payload?.row)} />} />
          {keys.map((k) => (
            <Area key={k} dataKey={k} stackId="status" type="linear" stroke={`var(--color-${k})`} strokeWidth={1.5} fill={`var(--color-${k})`} fillOpacity={0.35} isAnimationActive={false} />
          ))}
          {/* Six or more statuses: let whole items wrap rather than squeezing their names. */}
          <ChartLegend content={<ChartLegendContent className="flex-wrap gap-y-1 [&>div]:whitespace-nowrap" />} />
        </AreaChart>
      </ChartContainer>
    </HistoryChartCard>
  )
}
