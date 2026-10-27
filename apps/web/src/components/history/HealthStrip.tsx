import { CircleCheck, CircleDot, Minus, TriangleAlert, OctagonAlert } from "lucide-react"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { historyDayLabel, type HistoryRow } from "@/lib/data/history-series"
import { cn } from "@/lib/utils"
import type { HealthLevel } from "@jira-dashboard/core/metrics"

const ICONS: Record<HealthLevel, typeof CircleCheck> = {
  on_track: CircleCheck,
  at_risk: TriangleAlert,
  off_track: OctagonAlert,
  completed: CircleDot,
}
const ORDER: HealthLevel[] = ["on_track", "at_risk", "off_track", "completed"]

/** Sprint health per day: one cell each, coloured and labelled (never colour alone). */
export function HealthStrip({ rows }: { rows: HistoryRow[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Sprint health</CardTitle>
        <CardDescription>Done vs time gone in the day's sprint, at the end of each day.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-0.5" role="list" aria-label="Sprint health per day">
          {rows.map((r) => {
            const level = r.health ? HEALTH_LEVELS[r.health] : null
            const Icon = r.health ? ICONS[r.health] : Minus
            return (
              <Tooltip key={r.date}>
                <TooltipTrigger asChild>
                  <div
                    role="listitem"
                    aria-label={`${historyDayLabel(r)}: ${level?.label ?? (r.missing ? "no snapshot" : "no sprint")}`}
                    className={cn("flex h-7 min-w-1 flex-1 items-center justify-center rounded-[3px]", !level && "bg-muted")}
                    style={level ? { backgroundColor: `color-mix(in oklch, var(${level.colorVar}) 70%, transparent)` } : undefined}
                  >
                    {rows.length <= 31 && <Icon className="size-3 text-foreground/80" aria-hidden />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {historyDayLabel(r)}: {level?.label ?? (r.missing ? "no snapshot" : "no sprint running")}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {ORDER.map((h) => {
            const Icon = ICONS[h]
            return (
              <li key={h} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: `var(${HEALTH_LEVELS[h].colorVar})` }} aria-hidden />
                <Icon className="size-3" aria-hidden />
                {HEALTH_LEVELS[h].label}
              </li>
            )
          })}
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-muted" aria-hidden />
            No sprint or no snapshot
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}
