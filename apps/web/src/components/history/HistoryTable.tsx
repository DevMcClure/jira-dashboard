import { HEALTH_LEVELS } from "@/components/health/health-levels"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { HistoryRow } from "@/lib/data/history-series"

const num = (n: number | null) => (n === null ? "—" : String(n))

/** The same days as a table (newest first), with how each snapshot was made. */
export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Days</CardTitle>
        <CardDescription>Every day in the range. Backfilled days were rebuilt later from the changelog; stale ones from data generated before the day ended.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Sprint</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">WIP</TableHead>
                <TableHead className="text-right">Cycle time P85</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Snapshot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows].reverse().map((r) => (
                <TableRow key={r.date} className={r.missing ? "text-muted-foreground" : undefined}>
                  <TableCell className="tabular-nums">{r.label}</TableCell>
                  <TableCell>{r.sprint ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.remaining)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.wip)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.cycleTimeP85 === null ? "—" : `${r.cycleTimeP85} d`}</TableCell>
                  <TableCell>{r.health ? HEALTH_LEVELS[r.health].label : "—"}</TableCell>
                  <TableCell className="space-x-1">
                    {r.missing ? (
                      "None"
                    ) : (
                      <>
                        <Badge variant="outline" className="font-normal">{r.backfilled ? "Backfilled" : "On the day"}</Badge>
                        {r.stale && <Badge variant="outline" className="font-normal text-muted-foreground">Stale</Badge>}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
