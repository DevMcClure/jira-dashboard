import { useNavigate } from "react-router-dom"
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { useAppPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import { useFlowConfig } from "@/hooks/useFlowConfig"
import { formatDays } from "@/lib/format"
import type { AgingItem, Percentiles } from "@jira-dashboard/core/flow"
import { flowStateOf } from "@jira-dashboard/core/flowConfig"
import type { TimeMode } from "@jira-dashboard/core/working-time"
import { FlowChartCard } from "./FlowChartCard"

type Props = { aging: AgingItem[]; cycle: Percentiles; finished: number; mode: TimeMode; windowLabel: string }

const config = { age: { label: "Age", color: "var(--chart-1)" } } satisfies ChartConfig
const BANDS = [
  ["p50", "50%"],
  ["p85", "85%"],
  ["p95", "95%"],
] as const

/**
 * Aging WIP: each open item is a dot in its status column, at its age. The
 * lines are the cycle times that 50 / 85 / 95% of recently finished items stayed
 * under, so a dot above 85% is drifting past the team's usual.
 */
export function AgingWipChart({ aging, cycle, finished, mode, windowLabel }: Props) {
  const { dataset } = useData()
  const { config: cfg } = useFlowConfig()
  const navigate = useNavigate()
  const to = useAppPath()
  const columns = dataset.statuses
    .filter((s) => {
      const state = flowStateOf(s.name, { status: s.name, statusCategory: s.category }, cfg)
      return state === "active" || state === "waiting"
    })
    .map((s) => s.name)
  const perColumn = new Map<string, number>()
  const data = aging.map((a) => {
    const col = columns.indexOf(a.status)
    const n = perColumn.get(a.status) ?? 0
    perColumn.set(a.status, n + 1)
    // Spread dots in a column so equal ages don't hide each other.
    return { ...a, x: col + ((n % 7) - 3) * 0.07, age: Math.round(a.ageDays * 10) / 10 }
  })
  const unit = mode === "working" ? "working days" : "days"
  const over85 = cycle.p85 === null ? 0 : aging.filter((a) => a.ageDays > cycle.p85!).length

  return (
    <FlowChartCard
      title="Aging work in progress"
      description={`Open items by status and age since work started. Lines show the cycle-time percentiles (work started → done) of items finished ${windowLabel}, so like is compared with like. ${
        over85 ? `${over85} past the 85% line.` : "None past the 85% line."
      } Click a dot to open it.`}
      mode={mode}
      sample={finished}
      hint="Cycle time only describes finished work; age is the daily signal. Items drifting past the 85% line are the ones to swarm on or unblock first."
      empty={aging.length === 0 && "Nothing is in progress."}
      heightClass="h-80"
    >
      <ChartContainer config={config} className="aspect-auto h-80 w-full">
        <ScatterChart margin={{ top: 12, right: 48, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[-0.5, columns.length - 0.5]}
            ticks={columns.map((_, i) => i)}
            tickFormatter={(i: number) => columns[i] ?? ""}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
          />
          <YAxis type="number" dataKey="age" tickLine={false} axisLine={false} width={44} unit="d" allowDecimals={false} />
          <ZAxis range={[72, 72]} />
          {BANDS.map(([k, label]) =>
            cycle[k] === null ? null : (
              <ReferenceLine
                key={k}
                y={cycle[k]!}
                stroke="var(--muted-foreground)"
                strokeOpacity={k === "p85" ? 0.8 : 0.45}
                strokeDasharray={k === "p85" ? undefined : "4 4"}
                label={{ value: `${label} ${formatDays(cycle[k])}d`, position: "right", fill: "var(--muted-foreground)", fontSize: 11 }}
              />
            ),
          )}
          <ChartTooltip cursor={false} content={<AgingTip unit={unit} />} />
          <Scatter
            data={data}
            fill="var(--color-age)"
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

function AgingTip({ active, payload, unit }: { active?: boolean; payload?: { payload: AgingItem }[]; unit: string }) {
  const item = active ? payload?.[0]?.payload : undefined
  if (!item) return null
  return (
    <div className="grid max-w-64 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="font-mono text-muted-foreground">{item.key}</span>
      <span className="font-medium">{item.summary}</span>
      <span className="text-muted-foreground tabular-nums">
        {item.status} · {formatDays(item.ageDays)} {unit} old
      </span>
    </div>
  )
}
