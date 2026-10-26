import { StatCard, type Delta } from "@/components/dashboard/StatCard"
import type { flowDistribution, flowEfficiency, flowPredictability, flowVelocity, sizeMix } from "@/lib/jira/flow"
import { FLOW_TYPES } from "@/lib/jira/flowConfig"

type Props = {
  velocity: ReturnType<typeof flowVelocity>
  size: ReturnType<typeof sizeMix>
  efficiency: ReturnType<typeof flowEfficiency>
  distribution: ReturnType<typeof flowDistribution>
  predictability: ReturnType<typeof flowPredictability>
  /** Completes "… in the last 7 days". */
  periodPhrase: string
}

const neutral = (text: string): Delta => ({ text, direction: "flat", tone: "neutral" })

/** The supporting flow metrics (Flow Time and Flow Load lead the page as the primary targets). */
export function FlowKpiRow({ velocity, size, efficiency, distribution, predictability, periodPhrase }: Props) {
  const finished = FLOW_TYPES.reduce((n, t) => n + distribution.finished[t], 0)
  const featureShare = finished ? Math.round((distribution.finished.Feature / finished) * 100) : null
  const assessed = predictability.filter((p) => p.pct !== null).at(-1)
  const sign = velocity.delta >= 0 ? "+" : ""

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard
        label="Velocity"
        value={velocity.total}
        unit="items"
        delta={{
          text: `${sign}${velocity.delta} vs the previous period · counted regardless of size${size.median === null ? "" : ` (median ${size.median} pts)`}`,
          direction: velocity.delta > 0 ? "up" : velocity.delta < 0 ? "down" : "flat",
          tone: "neutral",
        }}
        trend={velocity.perWeek.map((w) => w.count)}
      />
      <StatCard
        label="Efficiency"
        value={efficiency.pct === null ? "—" : `${efficiency.pct}%`}
        delta={neutral(`active ÷ total flow time, ${periodPhrase}`)}
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
