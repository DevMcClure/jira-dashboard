import { StatCard, type Delta } from "@/components/dashboard/StatCard"
import type { flowPredictability, flowVelocity, sizeMix } from "@jira-dashboard/core/flow"

type Props = {
  velocity: ReturnType<typeof flowVelocity>
  size: ReturnType<typeof sizeMix>
  predictability: ReturnType<typeof flowPredictability>
}

const neutral = (text: string): Delta => ({ text, direction: "flat", tone: "neutral" })

/** The supporting flow metrics; distribution, efficiency, flow time and load have their own sections (decision 0047). */
export function FlowKpiRow({ velocity, size, predictability }: Props) {
  const assessed = predictability.filter((p) => p.pct !== null).at(-1)
  const sign = velocity.delta >= 0 ? "+" : ""

  return (
    <div className="grid grid-cols-2 gap-4">
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
        label="Predictability"
        value={assessed ? `${assessed.pct}%` : "—"}
        delta={neutral(assessed ? `${assessed.name} business value` : "no PI assessed yet")}
        trend={[]}
      />
    </div>
  )
}
