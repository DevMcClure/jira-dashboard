import { StatCard, type Delta } from "@/components/dashboard/StatCard"
import { formatDays } from "@/lib/format"
import type { flowDistribution, flowEfficiency, flowLoad, flowPredictability, flowTime, flowVelocity } from "@/lib/jira/flow"
import { FLOW_TYPES } from "@/lib/jira/flowConfig"
import type { TimeMode } from "@/lib/jira/working-time"

type Props = {
  velocity: ReturnType<typeof flowVelocity>
  time: ReturnType<typeof flowTime>
  load: ReturnType<typeof flowLoad>
  efficiency: ReturnType<typeof flowEfficiency>
  distribution: ReturnType<typeof flowDistribution>
  predictability: ReturnType<typeof flowPredictability>
  /** Completes "… in the last 7 days". */
  periodPhrase: string
  mode: TimeMode
}

const unitFor = (mode: TimeMode) => (mode === "working" ? "working days" : "days")
const neutral = (text: string): Delta => ({ text, direction: "flat", tone: "neutral" })

/** The six flow metrics as headline numbers, for the header period. */
export function FlowKpiRow({ velocity, time, load, efficiency, distribution, predictability, periodPhrase, mode }: Props) {
  const finished = FLOW_TYPES.reduce((n, t) => n + distribution.finished[t], 0)
  const featureShare = finished ? Math.round((distribution.finished.Feature / finished) * 100) : null
  const assessed = predictability.filter((p) => p.pct !== null).at(-1)

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        label="Velocity"
        value={velocity.total}
        unit="items"
        delta={{
          text: `${velocity.delta >= 0 ? "+" : ""}${velocity.delta} vs the previous period`,
          direction: velocity.delta > 0 ? "up" : velocity.delta < 0 ? "down" : "flat",
          tone: velocity.delta > 0 ? "good" : velocity.delta < 0 ? "bad" : "neutral",
        }}
        trend={velocity.perWeek.map((w) => w.count)}
      />
      <StatCard
        label="Flow time (85%)"
        value={formatDays(time.cycle.p85)}
        unit={unitFor(mode)}
        delta={neutral(`cycle time · ${time.points.length} finished ${periodPhrase}`)}
        trend={[]}
      />
      <StatCard
        label="Load"
        value={load.wipNow}
        unit="in progress"
        delta={neutral(`average age ${formatDays(load.avgAgeDays)} ${unitFor(mode)}`)}
        trend={load.daily.slice(-14).map((d) => d.wip)}
      />
      <StatCard
        label="Efficiency"
        value={efficiency.pct === null ? "—" : `${efficiency.pct}%`}
        delta={neutral(`active ÷ active + waiting, ${periodPhrase}`)}
        trend={efficiency.perWeek.map((w) => w.pct ?? 0)}
      />
      <StatCard
        label="Distribution"
        value={featureShare === null ? "—" : `${featureShare}%`}
        unit="features"
        delta={neutral(
          finished
            ? `${distribution.finished.Defect} defects · ${distribution.finished.Debt} debt · ${distribution.finished.Risk} risk`
            : `nothing finished ${periodPhrase}`,
        )}
        trend={[]}
      />
      <StatCard
        label="Predictability"
        value={assessed ? `${assessed.pct}%` : "—"}
        delta={neutral(assessed ? `${assessed.name} business value` : "no PI assessed yet")}
        trend={[]}
      />
    </div>
  )
}
