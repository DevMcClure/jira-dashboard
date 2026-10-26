import { format } from "date-fns"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatDays } from "@/lib/format"
import { FLOW_TIME_BASIS_LABEL, type FlowTimeBasis, type WeekCount, type WeekFlowTime } from "@jira-dashboard/core/flow"
import type { TimeMode } from "@jira-dashboard/core/working-time"
import { FlowChartCard } from "./FlowChartCard"

type Props = {
  flowTime: WeekFlowTime[]
  throughput: WeekCount[]
  basis: FlowTimeBasis
  mode: TimeMode
  windowLabel: string
  finished: number
}

const timeConfig = {
  p85: { label: "85% within", color: "var(--chart-1)" },
  p50: { label: "Typical (50%)", color: "var(--muted-foreground)" },
} satisfies ChartConfig
const countConfig = { count: { label: "Finished", color: "var(--chart-1)" } } satisfies ChartConfig

// Same margins and y-axis width on both charts so their weeks line up.
const MARGIN = { top: 8, right: 8, left: -12, bottom: 0 }
const Y_WIDTH = 44

/**
 * Flow time per week above throughput per week, on the same weeks. Two charts,
 * one axis each (never a dual axis), so a throughput dip lines up with a rise
 * in flow time.
 */
export function SpeedVsThroughput({ flowTime, throughput, basis, mode, windowLabel, finished }: Props) {
  const counts = new Map(throughput.map((w) => [w.week.getTime(), w.count]))
  const data = flowTime.map((w) => ({
    week: format(w.week, "d MMM"),
    p85: w.p85 === null ? null : Math.round(w.p85 * 10) / 10,
    p50: w.p50 === null ? null : Math.round(w.p50 * 10) / 10,
    count: counts.get(w.week.getTime()) ?? 0,
  }))
  const unit = mode === "working" ? "working days" : "days"
  return (
    <FlowChartCard
      title="Flow time vs throughput"
      description={`Weekly flow time (${FLOW_TIME_BASIS_LABEL[basis].toLowerCase()} to done) above items finished per week, ${windowLabel}.`}
      mode={mode}
      sample={finished}
      empty={finished === 0 && "Nothing finished in this window."}
      heightClass="h-96"
      hint="A dip in throughput while flow time rises often points to a bottleneck, such as manual QA or slow approvals. Improving flow time can also lower throughput for a while."
    >
      <div className="space-y-2">
        <ChartContainer config={timeConfig} className="aspect-auto h-52 w-full">
          <LineChart data={data} margin={MARGIN} syncId="speed-throughput">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="week" hide />
            <YAxis tickLine={false} axisLine={false} width={Y_WIDTH} unit="d" allowDecimals={false} />
            <ChartTooltip
              cursor={{ strokeWidth: 1 }}
              content={<ChartTooltipContent labelFormatter={(w) => `Finished week of ${w}`} formatter={(v, name) => `${timeConfig[name as keyof typeof timeConfig]?.label}: ${formatDays(Number(v))} ${unit}`} />}
            />
            <Line dataKey="p85" type="linear" stroke="var(--color-p85)" strokeWidth={2} connectNulls={false} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--color-p85)" }} isAnimationActive={false} />
            <Line dataKey="p50" type="linear" stroke="var(--color-p50)" strokeWidth={2} strokeDasharray="4 4" connectNulls={false} dot={false} isAnimationActive={false} />
            <ChartLegend content={<ChartLegendContent />} verticalAlign="top" />
          </LineChart>
        </ChartContainer>
        <ChartContainer config={countConfig} className="aspect-auto h-36 w-full">
          <BarChart data={data} margin={MARGIN} barCategoryGap="25%" syncId="speed-throughput">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={Y_WIDTH} allowDecimals={false} />
            <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent labelFormatter={(w) => `Week of ${w}`} />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
        <p className="text-center text-xs text-muted-foreground">Top: flow time in {unit}. Bottom: items finished.</p>
      </div>
    </FlowChartCard>
  )
}
