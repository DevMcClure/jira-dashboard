import { Users } from "lucide-react"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDays } from "@/lib/format"
import { FLOW_TIME_BASIS_LABEL, type FlowTimeBasis, type TeamFlow } from "@/lib/jira/flow"
import type { TimeMode } from "@/lib/jira/working-time"
import { ClockBadge } from "./ClockBadge"
import { FlowTypeBar } from "./FlowTypeBar"

type Props = { rows: TeamFlow[]; basis: FlowTimeBasis; mode: TimeMode; periodPhrase: string }

const HEAD = "h-9 text-xs font-medium tracking-wide text-muted-foreground uppercase"

/** The flow metrics per team. Deliberately team level only (decision 0024). */
export function TeamFlowTable({ rows, basis, mode, periodPhrase }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
        <CardDescription>
          Each team's flow {periodPhrase}. Flow time is {FLOW_TIME_BASIS_LABEL[basis].toLowerCase()}; load and per-member WIP are as of now.
        </CardDescription>
        <CardAction>
          <ClockBadge mode={mode} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>Team</TableHead>
              <TableHead className={`${HEAD} text-right`}>Finished</TableHead>
              <TableHead className={`${HEAD} text-right`}>Flow time 50% / 85%</TableHead>
              <TableHead className={`${HEAD} text-right`}>In progress</TableHead>
              <TableHead className={`${HEAD} text-right`}>Per member</TableHead>
              <TableHead className={`${HEAD} text-right`}>Efficiency</TableHead>
              <TableHead className={`${HEAD} w-40`}>Mix finished</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.teamId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right tabular-nums">{r.velocity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDays(r.flowTime.p50)} / {formatDays(r.flowTime.p85)}
                  <span className="ml-1 text-xs text-muted-foreground">(n {r.flowTime.n})</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.wip}</TableCell>
                <TableCell className="text-right tabular-nums">{r.wipPerMember === null ? "—" : r.wipPerMember.toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.efficiency === null ? "—" : `${r.efficiency}%`}</TableCell>
                <TableCell>
                  <FlowTypeBar counts={r.finished} label={`${r.name} finished mix`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5 shrink-0" aria-hidden />
        These are system measures for teams, for spotting where work gets stuck, not for rating or comparing individuals.
      </CardFooter>
    </Card>
  )
}
