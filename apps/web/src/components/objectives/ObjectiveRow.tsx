import { ChevronRight, LineChart } from "lucide-react"
import { StatusDot } from "@/components/common/StatusDot"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Issue, ProgramIncrement } from "@jira-dashboard/core/types"
import { ObjectiveEpics } from "./ObjectiveEpics"
import type { ObjectiveRowData } from "./objective-row-data"
import { TimeGoneBar } from "./TimeGoneBar"

type Props = {
  row: ObjectiveRowData
  pi: ProgramIncrement
  issues: Issue[]
  onOpenBurnup: () => void
}

const bv = (v: number | null) => (v === null ? "—" : String(v))

/** One objective: commitment, business value, progress vs time gone, health and forecast. Expands to its epics. */
export function ObjectiveRow({ row, pi, issues, onOpenBurnup }: Props) {
  const { objective: o, progress, health, forecast } = row
  const level = HEALTH_LEVELS[health.level]

  return (
    <Collapsible asChild>
      <li className="group/row">
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_12rem_9rem_auto]">
          <div className="min-w-0 space-y-1.5">
            <CollapsibleTrigger className="flex max-w-full items-center gap-1.5 text-left text-sm font-semibold hover:underline focus-visible:underline focus-visible:outline-none">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/row:rotate-90" />
              <span className="truncate">{o.title}</span>
            </CollapsibleTrigger>
            <div className="flex flex-wrap items-center gap-2 pl-5.5 text-xs text-muted-foreground tabular-nums">
              <Badge variant={o.committed ? "secondary" : "outline"} className="font-normal">
                {o.committed ? "Committed" : "Uncommitted"}
              </Badge>
              <span>
                BV {bv(o.plannedBusinessValue)} planned · {bv(o.actualBusinessValue)} actual
              </span>
            </div>
          </div>

          <div className="col-span-2 space-y-1.5 lg:col-span-1">
            <div className="flex justify-between text-xs tabular-nums">
              <span className="text-muted-foreground">
                {progress.byPoints ? `${progress.donePoints} / ${progress.totalPoints} pts` : `${progress.done} / ${progress.total} tickets`}
              </span>
              <span className="font-medium">{progress.pctDone}%</span>
            </div>
            <TimeGoneBar value={progress.pctDone} timeGone={health.pctElapsed} label={`${o.title}: ${progress.pctDone}% done`} />
          </div>

          <div className="space-y-1 text-xs">
            <Badge variant="outline" className="gap-1.5 font-normal">
              <StatusDot colorVar={level.colorVar} />
              {level.label}
            </Badge>
            <p className="text-muted-foreground tabular-nums">
              {forecast === null ? "No forecast" : pi.state === "closed" ? `Finished at ${forecast}%` : `Forecast ${forecast}%`}
            </p>
          </div>

          <Button variant="ghost" size="sm" onClick={onOpenBurnup} aria-label={`Burnup for ${o.title}`}>
            <LineChart />
            <span className="hidden xl:inline">Burnup</span>
          </Button>
        </div>
        <CollapsibleContent className="border-t bg-muted/20 px-6 py-4">
          <ObjectiveEpics objective={o} pi={pi} issues={issues} />
        </CollapsibleContent>
      </li>
    </Collapsible>
  )
}
