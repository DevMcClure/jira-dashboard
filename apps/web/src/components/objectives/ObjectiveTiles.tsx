import { StatusDot } from "@/components/common/StatusDot"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { Card, CardContent } from "@/components/ui/card"
import type { piPredictability } from "@jira-dashboard/core/metrics"
import type { ProgramIncrement } from "@jira-dashboard/core/types"
import type { ObjectiveRowData } from "./objective-row-data"

type Props = {
  pi: ProgramIncrement
  rows: ObjectiveRowData[]
  predictability: ReturnType<typeof piPredictability>
}

function Tile({ label, value, detail, colorVar }: { label: string; value: string; detail: string; colorVar?: string }) {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-2 px-5">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {colorVar && <StatusDot colorVar={colorVar} />}
          {label}
        </p>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

/** Committed objectives by health, the uncommitted count, and PI predictability. */
export function ObjectiveTiles({ pi, rows, predictability }: Props) {
  const committed = rows.filter((r) => r.objective.committed)
  const count = (level: string) => committed.filter((r) => r.health.level === level).length
  const closed = pi.state === "closed"

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {closed ? (
        <Tile
          label="Committed"
          value={String(committed.length)}
          detail={`${committed.filter((r) => r.health.pctDone === 100).length} fully delivered`}
        />
      ) : (
        (["on_track", "at_risk", "off_track"] as const).map((l) => (
          <Tile
            key={l}
            label={HEALTH_LEVELS[l].label}
            value={String(count(l))}
            detail="committed objectives"
            colorVar={HEALTH_LEVELS[l].colorVar}
          />
        ))
      )}
      <Tile
        label="Uncommitted"
        value={String(rows.length - committed.length)}
        detail="stretch objectives"
      />
      <Tile
        label="Predictability"
        value={predictability ? `${predictability.pct}%` : "—"}
        detail={
          predictability
            ? `${predictability.actual} of ${predictability.planned} planned business value`
            : closed
              ? "no business values assessed"
              : "assessed when the PI ends"
        }
      />
    </div>
  )
}
