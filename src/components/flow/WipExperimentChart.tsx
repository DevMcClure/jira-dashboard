import { format } from "date-fns"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { formatDays } from "@/lib/format"
import type { WeekLoad } from "@/lib/jira/flow"
import type { TimeMode } from "@/lib/jira/working-time"
import { FlowChartCard } from "./FlowChartCard"

const config = { week: { label: "Week", color: "var(--chart-1)" } } satisfies ChartConfig

type Props = { weeks: WeekLoad[]; mode: TimeMode; windowLabel: string }

/** One dot per week: average WIP against items finished, for finding the WIP level where throughput peaks. */
export function WipExperimentChart({ weeks, mode, windowLabel }: Props) {
  const data = weeks.map((w) => ({ ...w, label: format(w.week, "d MMM"), wip: Math.round(w.avgWip * 10) / 10 }))
  const unit = mode === "working" ? "working days" : "days"
  return (
    <FlowChartCard
      title="WIP vs throughput"
      description={`Each dot is a week ${windowLabel}: its average work in progress and the items it finished.`}
      mode="count"
      empty={weeks.length < 2 && "Needs at least two weeks of history."}
      hint="Look for the WIP level where throughput peaks while flow time stays steady (hover a week). Lower WIP limits gradually and watch both: there's no universal right number."
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <ScatterChart margin={{ top: 12, right: 16, left: -8, bottom: 12 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="wip"
            name="Average WIP"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, "auto"]}
            label={{ value: "Average items in progress", position: "insideBottom", offset: -8, fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis type="number" dataKey="throughput" name="Finished" tickLine={false} axisLine={false} width={44} allowDecimals={false} domain={[0, "auto"]} />
          <ZAxis range={[72, 72]} />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              const w = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined
              if (!w) return null
              return (
                <div className="grid gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <span className="font-medium">Week of {w.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {w.wip} in progress on average · {w.throughput} finished
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    Flow time 85%: {w.flowTimeP85 === null ? "—" : `${formatDays(w.flowTimeP85)} ${unit}`}
                  </span>
                </div>
              )
            }}
          />
          <Scatter data={data} fill="var(--color-week)" stroke="var(--card)" strokeWidth={2} isAnimationActive={false} />
        </ScatterChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
