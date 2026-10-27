import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAppPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import type { EpicProgress } from "@jira-dashboard/core/metrics"

const HEAD = "h-9 text-xs font-medium tracking-wide text-muted-foreground uppercase"

/** Progress per epic (the PI's features), least done first. */
export function EpicProgressTable({ epics }: { epics: EpicProgress[] }) {
  const { dataset } = useData()
  const navigate = useNavigate()
  const to = useAppPath()
  const teamNames = (ids: string[]) => ids.map((id) => dataset.teamById.get(id)?.name ?? id).join(", ")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Epics</CardTitle>
        <CardDescription>Features worked on in this PI, by points done. Click one to open it.</CardDescription>
      </CardHeader>
      <CardContent>
        {epics.length === 0 ? (
          <EmptyState className="h-24">No tickets in this PI are linked to an epic.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>Epic</TableHead>
                <TableHead className={HEAD}>Team</TableHead>
                <TableHead className={`${HEAD} w-[30%]`}>Progress</TableHead>
                <TableHead className={`${HEAD} text-right`}>Tickets</TableHead>
                <TableHead className={`${HEAD} text-right`}>Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epics.map((e) => {
                const name = dataset.byKey.get(e.epicKey)?.summary
                const open = () => navigate(to(`/tickets/${e.epicKey}`))
                return (
                  <TableRow
                    key={e.epicKey}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={open}
                    onKeyDown={(ev) => ev.key === "Enter" && open()}
                  >
                    <TableCell className="max-w-72">
                      <span className="block truncate font-medium">{name ?? e.epicKey}</span>
                      {name && <span className="font-mono text-xs text-muted-foreground">{e.epicKey}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{teamNames(e.teamIds) || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Progress value={e.pctDone} className="h-1.5" aria-label={`${e.pctDone}% done`} />
                        <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums">{e.pctDone}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {e.done} / {e.total}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {e.donePoints} / {e.points}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
