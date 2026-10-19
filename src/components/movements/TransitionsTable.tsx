import { ArrowRight, ChevronLeft, ChevronRight, CircleDot, Search, User } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { PersonAvatar } from "@/components/common/PersonAvatar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { StatusDot } from "@/components/common/StatusDot"
import { FilterPopover } from "@/components/filters/FilterPopover"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/hooks/useData"
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format"
import type { DateRange, Transition } from "@/lib/jira/types"

const HEAD = "h-9 text-xs font-medium tracking-wide text-muted-foreground uppercase"
const PAGE_SIZE = 25
const NOBODY = "__nobody__"

/** Every status transition in range, newest first, with search + to/by filters. */
export function TransitionsTable({ transitions, range }: { transitions: Transition[]; range: DateRange }) {
  const { dataset } = useData()
  const navigate = useNavigate()
  const now = dataset.meta.generatedAt
  const [query, setQuery] = useState("")
  const [toStatuses, setToStatuses] = useState<string[]>([])
  const [authors, setAuthors] = useState<string[]>([])
  const [page, setPage] = useState(0)

  const inRange = useMemo(
    () => transitions.filter((t) => t.at >= range.start && t.at <= range.end).reverse(),
    [transitions, range],
  )
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inRange.filter(
      (t) =>
        (!q ||
          t.issueKey.toLowerCase().includes(q) ||
          dataset.byKey.get(t.issueKey)?.summary.toLowerCase().includes(q)) &&
        (toStatuses.length === 0 || toStatuses.includes(t.to)) &&
        (authors.length === 0 || authors.includes(t.authorId ?? NOBODY)),
    )
  }, [inRange, query, toStatuses, authors, dataset])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(0)
  }

  const statusOptions = dataset.statuses
    .filter((s) => inRange.some((t) => t.to === s.name))
    .map((s) => ({
      value: s.name,
      label: s.name,
      icon: <StatusDot colorVar={s.colorVar} />,
      count: inRange.filter((t) => t.to === s.name).length,
    }))
  const authorIds = [...new Set(inRange.map((t) => t.authorId ?? NOBODY))]
  const authorOptions = authorIds
    .map((id) => ({
      value: id,
      label: id === NOBODY ? "Unknown" : (dataset.personById.get(id)?.displayName ?? id),
      count: inRange.filter((t) => (t.authorId ?? NOBODY) === id).length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <Card>
      <CardHeader>
        <CardTitle>All transitions</CardTitle>
        <CardDescription className="tabular-nums">
          {rows.length} of {inRange.length} status changes in this period
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => filter(setQuery)(e.target.value)}
              placeholder="Search ticket…"
              className="h-8 w-56 pl-8"
              aria-label="Search transitions"
            />
          </div>
          <FilterPopover
            title="Moved to"
            icon={CircleDot}
            align="start"
            emptyLabel=""
            options={statusOptions}
            selected={toStatuses}
            onChange={filter(setToStatuses)}
          />
          <FilterPopover
            title="By"
            icon={User}
            align="start"
            emptyLabel=""
            options={authorOptions}
            selected={authors}
            onChange={filter(setAuthors)}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>Ticket</TableHead>
              <TableHead className={HEAD}>From</TableHead>
              <TableHead className={HEAD}>To</TableHead>
              <TableHead className={HEAD}>By</TableHead>
              <TableHead className={HEAD}>At</TableHead>
              <TableHead className={`${HEAD} text-right`}>Time in previous</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState className="h-24" />
                </TableCell>
              </TableRow>
            ) : (
              visible.map((t) => {
                const open = () => navigate(`/tickets/${t.issueKey}`)
                return (
                  <TableRow
                    key={`${t.issueKey}-${t.at.getTime()}`}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={open}
                    onKeyDown={(e) => e.key === "Enter" && open()}
                  >
                    <TableCell className="xl:w-[34%] xl:max-w-0">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 font-mono text-xs">{t.issueKey}</span>
                        <span className="hidden truncate text-muted-foreground xl:inline">
                          {dataset.byKey.get(t.issueKey)?.summary}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{t.from ? <StatusBadge status={t.from} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                        <StatusBadge status={t.to} />
                      </span>
                    </TableCell>
                    <TableCell>
                      <PersonAvatar personId={t.authorId} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{formatRelative(t.at, now)}</span>
                        </TooltipTrigger>
                        <TooltipContent>{formatDateTime(t.at)}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.msInPrevious === null ? "—" : formatDuration(t.msInPrevious)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Page {current + 1} of {pageCount}
          </span>
          <Button variant="outline" size="icon" className="size-8" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-8" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
