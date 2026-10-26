import { PersonAvatar } from "@/components/common/PersonAvatar"
import { StatusDot } from "@/components/common/StatusDot"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { PiBurnupChart } from "@/components/pi/PiBurnupChart"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useData } from "@/hooks/useData"
import { objectiveIssues } from "@jira-dashboard/core/metrics"
import type { Issue, ProgramIncrement, Sprint } from "@jira-dashboard/core/types"
import type { ObjectiveRowData } from "./objective-row-data"

type Props = {
  row: ObjectiveRowData | null
  pi: ProgramIncrement
  sprints: Sprint[]
  issues: Issue[]
  onClose: () => void
}

/** Side sheet for one objective: who owns it, what it's linked to, and its burnup across the PI. */
export function ObjectiveSheet({ row, pi, sprints, issues, onClose }: Props) {
  const { dataset } = useData()
  const now = dataset.meta.generatedAt

  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-[640px]">
        {row && (
          <ScrollArea className="h-full">
            <SheetHeader className="gap-2 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.objective.committed ? "secondary" : "outline"} className="font-normal">
                  {row.objective.committed ? "Committed" : "Uncommitted"}
                </Badge>
                <Badge variant="outline" className="gap-1.5 font-normal">
                  <StatusDot colorVar={HEALTH_LEVELS[row.health.level].colorVar} />
                  {HEALTH_LEVELS[row.health.level].label}
                </Badge>
              </div>
              <SheetTitle className="text-lg">{row.objective.title}</SheetTitle>
              <SheetDescription>
                {row.objective.description ?? `${pi.name} objective`}
              </SheetDescription>
            </SheetHeader>
            <Separator />
            <dl className="grid grid-cols-2 gap-4 p-6 text-sm sm:grid-cols-4">
              <Meta label="Owner">
                <PersonAvatar personId={row.objective.ownerId} />
              </Meta>
              <Meta label="Team">
                {row.objective.teamId ? (dataset.teamById.get(row.objective.teamId)?.name ?? row.objective.teamId) : "ART level"}
              </Meta>
              <Meta label="Business value">
                {row.objective.plannedBusinessValue ?? "—"} planned · {row.objective.actualBusinessValue ?? "—"} actual
              </Meta>
              <Meta label="Done">
                {row.progress.pctDone}%{row.forecast !== null && pi.state === "active" && ` · forecast ${row.forecast}%`}
              </Meta>
            </dl>
            <Separator />
            <div className="space-y-3 p-6">
              <div>
                <h3 className="text-sm font-semibold">Burnup</h3>
                <p className="text-xs text-muted-foreground">
                  Points done against total scope for this objective's tickets, across {pi.name}.
                </p>
              </div>
              <PiBurnupChart pi={pi} sprints={sprints} issues={objectiveIssues(row.objective, pi, issues)} now={now} bare />
            </div>
            <Separator />
            <div className="space-y-2 p-6">
              <h3 className="text-sm font-semibold">Linked epics</h3>
              {row.objective.epicKeys.length ? (
                <ul className="space-y-1 text-sm">
                  {row.objective.epicKeys.map((k) => (
                    <li key={k}>
                      {dataset.byKey.get(k)?.summary ?? k} <span className="font-mono text-xs text-muted-foreground">{k}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No epics; progress comes from directly linked tickets.</p>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}
