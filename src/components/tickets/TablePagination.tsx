import type { ReactTable } from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TicketFeatures, TicketRow } from "./table-setup"

type Props = { table: ReactTable<TicketFeatures, TicketRow>; totalRows: number }

export function TablePagination({ table, totalRows }: Props) {
  const { pageIndex, pageSize } = table.state.pagination
  const filtered = table.getFilteredRowModel().rows.length
  const pageCount = Math.max(1, table.getPageCount())
  const from = filtered === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min(filtered, (pageIndex + 1) * pageSize)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p className="tabular-nums">
        {filtered === 0 ? "No tickets" : `Showing ${from}–${to} of ${filtered}`}
        {filtered !== totalRows && ` (filtered from ${totalRows})`}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          Page {Math.min(pageIndex + 1, pageCount)} of {pageCount}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()} aria-label="First page">
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()} aria-label="Last page">
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
