import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { EmptyState } from "@/components/common/EmptyState"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { velocity } from "@jira-dashboard/core/metrics"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoad } from "@/hooks/useFirstLoad"

const config = {
  committed: { label: "Committed", color: "var(--chart-2)" },
  completed: { label: "Completed", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Committed vs completed points for each closed sprint. */
export function VelocityChart({ data }: { data: ReturnType<typeof velocity> }) {
  const loading = useFirstLoad()
  if (loading) return <Skeleton className="h-44 w-full" />
  if (data.length === 0) return <EmptyState className="h-44">No closed sprints yet.</EmptyState>
  const rows = data.map((d) => ({ ...d, label: d.sprintName.replace(/^\S+\s/, "") }))
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <BarChart data={rows} margin={{ top: 8, right: 0, left: -20, bottom: 0 }} barGap={2} barCategoryGap="30%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.4 }}
          content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.sprintName} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="committed" fill="var(--color-committed)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  )
}
