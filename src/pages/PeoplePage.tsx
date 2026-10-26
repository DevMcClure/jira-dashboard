import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { PersonAvatar } from "@/components/common/PersonAvatar"
import { StatusDot } from "@/components/common/StatusDot"
import { PageHeader } from "@/components/layout/PageHeader"
import { WorkloadBar } from "@/components/people/WorkloadBar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAppPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { CATEGORY_COLOR_VAR } from "@/lib/jira/constants"
import { workloadByPerson } from "@/lib/jira/metrics"

const HEAD = "h-9 text-xs font-medium tracking-wide text-muted-foreground uppercase"

export default function PeoplePage() {
  const { dataset, filters, setFilters } = useData()
  const issues = useFilteredIssues()
  const navigate = useNavigate()
  const to = useAppPath()
  const rows = useMemo(() => workloadByPerson(issues), [issues])
  const max = Math.max(0, ...rows.map((r) => r.total))
  const teamsOf = (id: string | null) =>
    id
      ? dataset.teams
          .filter((t) => t.memberIds.includes(id))
          .map((t) => t.name)
          .join(", ")
      : ""

  const open = (personId: string | null) => {
    setFilters({ ...filters, assigneeIds: [personId] })
    navigate(to("/tickets"))
  }

  return (
    <>
      <PageHeader title="People" description="Who is working on what, sorted by open story points." />
      <Card>
        <CardHeader>
          <CardTitle>Workload</CardTitle>
          <CardDescription>Click a person to see their tickets.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState className="h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>Person</TableHead>
                  <TableHead className={`${HEAD} text-right`}>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot colorVar={CATEGORY_COLOR_VAR.todo} /> To do
                    </span>
                  </TableHead>
                  <TableHead className={`${HEAD} text-right`}>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot colorVar={CATEGORY_COLOR_VAR.in_progress} /> In progress
                    </span>
                  </TableHead>
                  <TableHead className={`${HEAD} text-right`}>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot colorVar={CATEGORY_COLOR_VAR.done} /> Done
                    </span>
                  </TableHead>
                  <TableHead className={`${HEAD} text-right`}>Open pts</TableHead>
                  <TableHead className={`${HEAD} text-right`}>Total pts</TableHead>
                  <TableHead className={`${HEAD} w-[28%]`}>Breakdown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((w) => (
                  <TableRow
                    key={w.personId ?? "unassigned"}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => open(w.personId)}
                    onKeyDown={(e) => e.key === "Enter" && open(w.personId)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <PersonAvatar personId={w.personId} size="md" />
                        {w.personId && <span className="pl-10 text-xs text-muted-foreground">{teamsOf(w.personId)}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{w.todo}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.in_progress}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.done}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{w.openPoints}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{w.points}</TableCell>
                    <TableCell>
                      <WorkloadBar workload={w} max={max} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
