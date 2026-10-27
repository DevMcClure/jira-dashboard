import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { EmptyState } from "@/components/common/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { workloadByPerson } from "@jira-dashboard/core/metrics"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoad } from "@/hooks/useFirstLoad"

const config = {
  todo: { label: "To Do", color: "var(--status-todo)" },
  in_progress: { label: "In Progress", color: "var(--status-progress)" },
  done: { label: "Done", color: "var(--status-done)" },
} satisfies ChartConfig

const ROW = 30

/** Horizontal stacked bars: tickets per assignee by status category. */
export function AssigneeChart() {
  const { dataset } = useData()
  const issues = useFilteredIssues()
  const data = useMemo(
    () =>
      workloadByPerson(issues).map((w) => ({
        name: w.personId ? (dataset.personById.get(w.personId)?.displayName ?? w.personId) : "Unassigned",
        todo: w.todo,
        in_progress: w.in_progress,
        done: w.done,
      })),
    [issues, dataset],
  )

  const loading = useFirstLoad()
  const height = data.length * ROW + 56

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets by assignee</CardTitle>
        <CardDescription>Sorted by open story points</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="w-full" style={{ height }} />
        ) : data.length === 0 ? (
          <EmptyState className="h-40">No tickets for the current filters.</EmptyState>
        ) : (
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} interval={0} />
              <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              {(["todo", "in_progress", "done"] as const).map((key, i, all) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={`var(--color-${key})`}
                  stroke="var(--card)"
                  strokeWidth={2}
                  maxBarSize={20}
                  radius={i === all.length - 1 ? [0, 4, 4, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
