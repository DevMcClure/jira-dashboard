import { ArrowRight, Target } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { pluralize } from "@/lib/format"
import type { piHealth } from "@/lib/jira/metrics"
import type { ProgramIncrement } from "@/lib/jira/types"

const MAX_LISTED = 5

type Props = {
  pi: ProgramIncrement
  health: ReturnType<typeof piHealth>
  /** Sprints in the PI per team (teams share the calendar), not the total across teams. */
  sprintsPerTeam: number
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-2 px-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
      </CardContent>
    </Card>
  )
}

/** Headline PI numbers plus its objectives. */
export function PiSummary({ pi, health, sprintsPerTeam }: Props) {
  const closed = pi.state === "closed"
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Done" value={`${health.pctDone}%`} detail={`of points · ${health.pctElapsed}% of time gone`} />
        <Tile label="Points" value={`${health.donePoints} / ${health.totalPoints}`} detail="done / in scope" />
        <Tile label="Tickets" value={String(health.ticketCount)} detail={`across ${pluralize(sprintsPerTeam, "sprint")}`} />
        <Tile
          label={closed ? "Finished" : "Days left"}
          value={closed ? "✓" : String(health.daysLeft)}
          detail={closed ? "PI is over" : pi.state === "future" ? "not started yet" : "until the PI ends"}
        />
      </div>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-muted-foreground" />
            Objectives
          </CardTitle>
          <CardDescription>
            {pi.objectives.length
              ? `${pi.objectives.filter((o) => o.committed).length} committed, ${pi.objectives.filter((o) => !o.committed).length} uncommitted`
              : "What this PI committed to"}
          </CardDescription>
          {pi.objectives.length > 0 && (
            <CardAction>
              <Button variant="ghost" size="sm" className="-my-1.5 h-7" asChild>
                <Link to="/objectives">
                  View all <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {pi.objectives.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {[...pi.objectives]
                .sort((a, b) => Number(b.committed) - Number(a.committed))
                .slice(0, MAX_LISTED)
                .map((o) => (
                  <li key={o.id} className="truncate">
                    {o.title}
                  </li>
                ))}
              {pi.objectives.length > MAX_LISTED && (
                <li className="list-none text-muted-foreground">+{pi.objectives.length - MAX_LISTED} more</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No objectives in the export.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
