import { useTable } from "@tanstack/react-table"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ticketColumns } from "./columns"
import { TablePagination } from "./TablePagination"
import { searchKeyOrSummary, ticketFeatures, type TicketRow } from "./table-setup"
import { TicketsToolbar } from "./TicketsToolbar"

type Props = { rows: TicketRow[]; activeKey?: string }

/** TanStack data table: search, facets, sorting, column visibility, pagination. */
export function TicketsTable({ rows, activeKey }: Props) {
  const navigate = useNavigate()
  const table = useTable({
    features: ticketFeatures,
    columns: ticketColumns,
    data: rows,
    getRowId: (row) => row.key,
    globalFilterFn: searchKeyOrSummary,
    // Search runs once per row (the fn checks key + summary itself).
    getColumnCanGlobalFilter: (column) => column.id === "key",
    initialState: {
      sorting: [{ id: "updated", desc: true }],
      pagination: { pageIndex: 0, pageSize: 25 },
      columnVisibility: { created: false },
    },
  })

  const pageRows = table.getRowModel().rows
  const columnCount = table.getVisibleLeafColumns().length
  const open = (key: string) => navigate(`/tickets/${key}`)

  return (
    <div className="flex flex-col gap-4">
      <TicketsToolbar table={table} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="h-10 px-3 text-muted-foreground first:pl-4 last:pr-4">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount}>
                  <EmptyState className="h-32" />
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  data-state={row.id === activeKey ? "selected" : undefined}
                  aria-label={`${row.original.key}: ${row.original.summary}`}
                  onClick={() => open(row.original.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      open(row.original.key)
                    }
                  }}
                  className={cn("cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2.5 first:pl-4 last:pr-4">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination table={table} totalRows={rows.length} />
    </div>
  )
}
