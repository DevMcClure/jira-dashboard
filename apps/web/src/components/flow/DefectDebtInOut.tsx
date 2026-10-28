import { format } from "date-fns"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { flowInOut } from "@jira-dashboard/core/flow"
import { FlowChartCard } from "./FlowChartCard"
import { flowTypeVar } from "./flow-type-colors"

type InOut = ReturnType<typeof flowInOut>
type Props = { defect: InOut; debt: InOut; windowLabel: string }
type View = "Defect" | "Debt"

const NOUN: Record<View, string> = { Defect: "defects", Debt: "debt items" }

/** Defects or debt created vs finished per week, with the open count at the window's start and end. */
export function DefectDebtInOut({ defect, debt, windowLabel }: Props) {
  const [view, setView] = useState<View>("Defect")
  const flow = view === "Defect" ? defect : debt
  const config = {
    created: { label: "Created", color: `var(${flowTypeVar(view)})` },
    finished: { label: "Finished", color: "var(--muted-foreground)" },
  } satisfies ChartConfig
  const data = flow.perWeek.map((w) => ({ week: format(w.week, "d MMM"), created: w.created, finished: w.finished, open: w.open }))
  const change = flow.openAtEnd - flow.openAtStart
  const changeText = change === 0 ? "no change" : `${change > 0 ? "+" : "−"}${Math.abs(change)}`

  return (
    <FlowChartCard
      title="Defects and debt: in vs out"
      description={`${flow.created} ${NOUN[view]} created and ${flow.finished} finished ${windowLabel}. Open: ${flow.openAtStart} → ${flow.openAtEnd} (${changeText}).`}
      mode="count"
      empty={flow.created + flow.finished + flow.openAtStart === 0 && `No ${NOUN[view]} ${windowLabel}.`}
      actions={
        <ToggleGroup type="single" size="sm" variant="outline" value={view} onValueChange={(v) => v && setView(v as View)} aria-label="Flow type">
          <ToggleGroupItem value="Defect" className="h-6 px-2 text-xs">
            Defects
          </ToggleGroupItem>
          <ToggleGroupItem value="Debt" className="h-6 px-2 text-xs">
            Debt
          </ToggleGroupItem>
        </ToggleGroup>
      }
      hint="When more arrive than finish week after week, the open count climbs and the team is falling behind on quality. Counts only items in the scope's sprints."
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }} barCategoryGap="20%" barGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <ChartTooltip
            cursor={{ fillOpacity: 0.4 }}
            content={
              <ChartTooltipContent
                labelFormatter={(w, payload) => {
                  const open = (payload?.[0]?.payload as { open?: number } | undefined)?.open
                  return `Week of ${w}${open === undefined ? "" : ` · ${open} open at the end`}`
                }}
              />
            }
          />
          <Bar dataKey="created" fill="var(--color-created)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="finished" fill="var(--color-finished)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
