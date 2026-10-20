import { format } from "date-fns"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusDot } from "@/components/common/StatusDot"
import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { SprintHealthCard } from "@/components/health/SprintHealthCard"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { useScopedSprints } from "@/hooks/useScopedSprints"
import { burndown, scopeChange, sprintHealth, type HealthLevel } from "@/lib/jira/metrics"
import type { Sprint } from "@/lib/jira/types"

const HEAD = "h-9 text-xs font-medium tracking-wide text-muted-foreground uppercase"
const ORDER: HealthLevel[] = ["off_track", "at_risk", "on_track", "completed"]

export default function HealthPage() {
  const { dataset, setBurndownSprintId } = useData()
  const issues = useFilteredIssues()
  const sprints = useScopedSprints()
  const navigate = useNavigate()
  const now = dataset.meta.generatedAt

  const rows = useMemo(
    () =>
      sprints
        .filter((s) => s.state !== "future")
        .map((s) => ({
          sprint: s,
          health: sprintHealth(s, issues, now),
          scope: scopeChange(s, issues),
          burndown: burndown(s, issues, now),
        })),
    [sprints, issues, now],
  )
  // Worst first, so problems are at the top.
  const active = rows
    .filter((r) => r.sprint.state === "active")
    .sort((a, b) => ORDER.indexOf(a.health.level) - ORDER.indexOf(b.health.level))
  const closed = rows
    .filter((r) => r.sprint.state === "closed")
    .sort((a, b) => (b.sprint.endDate?.getTime() ?? 0) - (a.sprint.endDate?.getTime() ?? 0))
  const counts = Object.fromEntries(ORDER.map((l) => [l, rows.filter((r) => r.health.level === l).length]))
  const teamName = (s: Sprint) => (s.teamId ? dataset.teamById.get(s.teamId)?.name : undefined)

  const open = (s: Sprint) => {
    setBurndownSprintId(s.id)
    navigate(s.teamId ? `/teams/${s.teamId}` : "/details")
  }

  return (
    <>
      <PageHeader title="Health" description="Is each sprint on track? Points done compared with time elapsed." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {ORDER.map((l) => (
          <Card key={l} className="gap-0 py-5">
            <CardContent className="space-y-2 px-5">
              <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <StatusDot colorVar={HEALTH_LEVELS[l].colorVar} />
                {HEALTH_LEVELS[l].label}
              </p>
              <p className="text-3xl font-semibold tabular-nums">{counts[l]}</p>
              <p className="text-xs text-muted-foreground">{l === "completed" ? "closed sprints" : "active sprints"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 && <EmptyState className="h-40">No started sprints for the current filters.</EmptyState>}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active sprints</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((r) => (
              <SprintHealthCard key={r.sprint.id} {...r} teamName={teamName(r.sprint)} onOpen={() => open(r.sprint)} />
            ))}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Closed sprints</CardTitle>
            <CardDescription>How each sprint finished</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>Sprint</TableHead>
                  <TableHead className={HEAD}>Team</TableHead>
                  <TableHead className={HEAD}>Ended</TableHead>
                  <TableHead className={`${HEAD} text-right`}>Done</TableHead>
                  <TableHead className={`${HEAD} text-right`}>Points</TableHead>
                  <TableHead className={`${HEAD} text-right`}>Scope change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map(({ sprint, health, scope }) => (
                  <TableRow
                    key={sprint.id}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => open(sprint)}
                    onKeyDown={(e) => e.key === "Enter" && open(sprint)}
                  >
                    <TableCell className="font-medium">{sprint.name}</TableCell>
                    <TableCell className="text-muted-foreground">{teamName(sprint) ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {sprint.endDate ? format(sprint.endDate, "d MMM") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{health.pctDone}%</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {health.donePoints} / {health.totalPoints}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {scope.added || scope.removed ? `+${scope.added} / −${scope.removed}` : "None"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        A sprint is <strong className="font-medium">at risk</strong> when its % of points done trails % of time elapsed
        by more than 15 points, and <strong className="font-medium">off track</strong> when it trails by more than 30.
      </p>
    </>
  )
}
