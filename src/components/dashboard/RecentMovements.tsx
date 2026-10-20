import { ArrowRight } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { PersonAvatar } from "@/components/common/PersonAvatar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/hooks/useData"
import { useFilteredTransitions } from "@/hooks/useFilteredTransitions"
import { usePeriod } from "@/hooks/usePeriod"
import { formatDateTime, formatRelative } from "@/lib/format"

const HEAD = "h-9 text-xs font-medium tracking-wide text-muted-foreground uppercase"

export function RecentMovements({ limit = 15 }: { limit?: number }) {
  const { dataset } = useData()
  const navigate = useNavigate()
  const { range, phrase } = usePeriod()
  const inPeriod = useFilteredTransitions().filter((t) => t.at >= range.start && t.at <= range.end)
  const recent = inPeriod.slice(-limit).reverse()
  const now = dataset.meta.generatedAt

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Recent movements</CardTitle>
        <CardDescription className="tabular-nums">
          {inPeriod.length > limit
            ? `Latest ${limit} of ${inPeriod.length} status changes ${phrase}`
            : `Status changes ${phrase}`}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/movements">
              View all <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>Ticket</TableHead>
              <TableHead className={HEAD}>Movement</TableHead>
              <TableHead className={HEAD}>By</TableHead>
              <TableHead className={`${HEAD} text-right`}>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4}>
                  <EmptyState className="h-24">No status changes {phrase}.</EmptyState>
                </TableCell>
              </TableRow>
            ) : (
              recent.map((t) => {
                const issue = dataset.byKey.get(t.issueKey)
                const open = () => navigate(`/tickets/${t.issueKey}`)
                return (
                  <TableRow
                    key={`${t.issueKey}-${t.at.getTime()}`}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={open}
                    onKeyDown={(e) => e.key === "Enter" && open()}
                  >
                    <TableCell className="xl:w-[40%] xl:max-w-0">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 font-mono text-xs">{t.issueKey}</span>
                        <span className="hidden truncate text-muted-foreground xl:inline">{issue?.summary}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {t.from && <StatusBadge status={t.from} />}
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-label="to" />
                        <StatusBadge status={t.to} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <PersonAvatar personId={t.authorId} className="[&>span:last-child]:hidden xl:[&>span:last-child]:inline" />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{formatRelative(t.at, now)}</span>
                        </TooltipTrigger>
                        <TooltipContent>{formatDateTime(t.at)}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
