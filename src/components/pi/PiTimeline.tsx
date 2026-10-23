import { format } from "date-fns"
import { StatusDot } from "@/components/common/StatusDot"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useData } from "@/hooks/useData"
import { sprintHealth } from "@/lib/jira/metrics"
import type { Issue, Sprint, Team } from "@/lib/jira/types"
import { cn } from "@/lib/utils"

type Props = {
  teams: Team[]
  sprints: Sprint[]
  issues: Issue[]
  onOpen: (sprint: Sprint) => void
}

const DAY_FMT = "d MMM"

/** The PI's sprint calendar: one column per sprint slot, one row per team. */
export function PiTimeline({ teams, sprints, issues, onOpen }: Props) {
  const { dataset } = useData()
  const now = dataset.meta.generatedAt
  const rows = teams
    .map((t) => ({ team: t, sprints: sprints.filter((s) => s.teamId === t.id) }))
    .filter((r) => r.sprints.length)
  // Every team shares the calendar, so the longest row gives the slots' dates.
  const slots = rows.reduce<Sprint[]>((best, r) => (r.sprints.length > best.length ? r.sprints : best), [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sprints</CardTitle>
        <CardDescription>Health of each team's sprints in this PI. Click one to see its tickets.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div
          className="grid min-w-[40rem] gap-2"
          style={{ gridTemplateColumns: `7rem repeat(${slots.length}, minmax(0, 1fr))` }}
        >
          <div />
          {slots.map((s, i) => (
            <div key={s.id} className="px-1 text-xs text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">Sprint {i + 1}</span>
              {s.startDate && s.endDate && (
                <span className="block">
                  {format(s.startDate, DAY_FMT)} – {format(s.endDate, DAY_FMT)}
                </span>
              )}
            </div>
          ))}
          {rows.map(({ team, sprints: row }) => (
            <TeamRow key={team.id} team={team} sprints={row} issues={issues} now={now} onOpen={onOpen} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TeamRow({
  team,
  sprints,
  issues,
  now,
  onOpen,
}: { team: Team; sprints: Sprint[]; issues: Issue[]; now: Date; onOpen: (s: Sprint) => void }) {
  return (
    <>
      <div className="flex items-center truncate text-sm font-medium">{team.name}</div>
      {sprints.map((s) => {
        const future = s.state === "future"
        const health = future ? null : sprintHealth(s, issues, now)
        const level = health ? HEALTH_LEVELS[health.level] : null
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onOpen(s)}
            title={s.goal ?? s.name}
            className={cn(
              "min-w-0 rounded-lg border px-3 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              s.state === "active" && "border-primary/50 bg-primary/5",
              future && "border-dashed",
            )}
          >
            <span className="block truncate text-xs font-semibold">{s.name}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              {level && <StatusDot colorVar={level.colorVar} />}
              {health ? `${health.pctDone}% · ${level!.label}` : "Planned"}
            </span>
          </button>
        )
      })}
    </>
  )
}
