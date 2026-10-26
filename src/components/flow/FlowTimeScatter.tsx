import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { useAppPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import { formatDays } from "@/lib/format"
import { FLOW_TIME_BASIS_LABEL, flowTimeDays, type FlowTimeBasis, type FlowTimePoint, type Percentiles } from "@/lib/jira/flow"
import type { TimeMode } from "@/lib/jira/working-time"
import { FlowChartCard } from "./FlowChartCard"

type Props = { points: FlowTimePoint[]; percentiles: Percentiles; basis: FlowTimeBasis; mode: TimeMode; windowLabel: string }

const config = { days: { label: "Flow time", color: "var(--chart-1)" } } satisfies ChartConfig

/** Flow time: one dot per finished item (when it finished × how long it took), with percentile lines. Follows the basis switch. */
export function FlowTimeScatter({ points, percentiles: cycle, basis, mode, windowLabel }: Props) {
  const { dataset } = useData()
  const navigate = useNavigate()
  const to = useAppPath()
  const data = points.map((p) => ({ ...p, t: p.doneAt.getTime(), days: Math.round(flowTimeDays(p, basis) * 10) / 10 }))
  const unit = mode === "working" ? "working days" : "days"
  return (
    <FlowChartCard
      title="Flow time per item"
      description={`${FLOW_TIME_BASIS_LABEL[basis]} → done for each item finished ${windowLabel}. 85% finished within ${formatDays(cycle.p85)} ${unit}.`}
      mode={mode}
      sample={points.length}
      empty={points.length === 0 && "Nothing finished in this window."}
      hint="Dots far above the 85% line are outliers worth a look; a cloud drifting upward over time means work is getting slower."
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <ScatterChart margin={{ top: 12, right: 48, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            type="number"
            dataKey="t"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(t: number) => format(t, "d MMM")}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
          />
          <YAxis type="number" dataKey="days" tickLine={false} axisLine={false} width={44} unit="d" allowDecimals={false} />
          <ZAxis range={[64, 64]} />
          {(["p50", "p85", "p95"] as const).map((k) =>
            cycle[k] === null ? null : (
              <ReferenceLine
                key={k}
                y={cycle[k]!}
                stroke="var(--muted-foreground)"
                strokeOpacity={k === "p85" ? 0.8 : 0.45}
                strokeDasharray={k === "p85" ? undefined : "4 4"}
                label={{ value: `${k.slice(1)}%`, position: "right", fill: "var(--muted-foreground)", fontSize: 11 }}
              />
            ),
          )}
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined
              if (!p) return null
              return (
                <div className="grid max-w-64 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <span className="font-mono text-muted-foreground">{p.key}</span>
                  <span className="font-medium">{dataset.byKey.get(p.key)?.summary}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDays(flowTimeDays(p, basis))} {unit} · done {format(p.doneAt, "d MMM")}
                  </span>
                </div>
              )
            }}
          />
          <Scatter
            data={data}
            fill="var(--color-days)"
            fillOpacity={0.8}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
            className="cursor-pointer"
            onClick={(point) => {
              const key = (point.payload as { key?: string } | undefined)?.key
              if (key) navigate(to(`/tickets/${key}`))
            }}
          />
        </ScatterChart>
      </ChartContainer>
    </FlowChartCard>
  )
}
