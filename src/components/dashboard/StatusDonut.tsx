import { useMemo } from "react"
import { Label, Pie, PieChart } from "recharts"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusDot } from "@/components/common/StatusDot"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { countByStatus } from "@/lib/jira/metrics"

export function StatusDonut() {
  const issues = useFilteredIssues()
  const rows = useMemo(() => countByStatus(issues), [issues])
  const total = issues.length
  const data = rows.map((r) => ({ ...r, fill: `var(${r.colorVar})` }))
  const config = Object.fromEntries(rows.map((r) => [r.status, { label: r.status }])) satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
        <CardDescription>Where every ticket is right now</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {total === 0 ? (
          <EmptyState className="h-64">No tickets for the current filters.</EmptyState>
        ) : (
          <>
            <ChartContainer config={config} className="mx-auto aspect-square h-44">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="status" />} />
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={56}
                  outerRadius={80}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  <Label
                    content={({ viewBox }) =>
                      viewBox && "cx" in viewBox ? (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                            {total}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                            tickets
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm xl:grid-cols-2">
              {rows.map((r) => (
                <li key={r.status} className="flex items-center gap-2">
                  <StatusDot colorVar={r.colorVar} />
                  <span className="truncate text-muted-foreground">{r.status}</span>
                  <span className="ml-auto font-medium tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
