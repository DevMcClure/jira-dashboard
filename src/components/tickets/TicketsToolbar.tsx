import type { ReactTable } from "@tanstack/react-table"
import { CircleDot, Gauge, Layers, Search, Settings2, User, X } from "lucide-react"
import { StatusDot } from "@/components/common/StatusDot"
import { FilterPopover, type FilterOption } from "@/components/filters/FilterPopover"
import { UNASSIGNED } from "@/components/filters/GlobalFilters"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useData } from "@/hooks/useData"
import { ISSUE_TYPES, PRIORITIES } from "@/lib/jira/constants"
import { PriorityIcon, TypeIcon } from "./IssueIcons"
import { COLUMN_LABELS, type TicketFeatures, type TicketRow } from "./table-setup"

type Props = { table: ReactTable<TicketFeatures, TicketRow> }

export function TicketsToolbar({ table }: Props) {
  const { dataset } = useData()
  const { globalFilter, columnFilters } = table.state
  const isFiltered = columnFilters.length > 0 || Boolean(globalFilter)

  /** Facet wiring for a column: options (with counts) + selected values. */
  const facet = (id: string, options: Omit<FilterOption, "count">[]) => {
    const column = table.getColumn(id)
    const counts = column?.getFacetedUniqueValues() ?? new Map<unknown, number>()
    const selected = (column?.getFilterValue() as string[] | undefined) ?? []
    return {
      // Keep options that exist in the data (or are currently selected).
      options: options
        .filter((o) => counts.has(o.value) || selected.includes(o.value))
        .map((o) => ({ ...o, count: counts.get(o.value) ?? 0 })),
      selected,
      onChange: (v: string[]) => column?.setFilterValue(v.length ? v : undefined),
    }
  }

  const types = [...ISSUE_TYPES, ...new Set(dataset.issues.map((i) => i.type))].filter((t, i, a) => a.indexOf(t) === i)
  const people = [...dataset.people].sort((a, b) => a.displayName.localeCompare(b.displayName))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={String(globalFilter ?? "")}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          placeholder="Search key or summary…"
          className="h-8 w-56 pl-8 lg:w-64"
          aria-label="Search tickets"
        />
      </div>
      <FilterPopover
        title="Status"
        icon={CircleDot}
        align="start"
        emptyLabel=""
        {...facet(
          "status",
          dataset.statuses.map((s) => ({ value: s.name, label: s.name, icon: <StatusDot colorVar={s.colorVar} /> })),
        )}
      />
      <FilterPopover
        title="Type"
        icon={Layers}
        align="start"
        emptyLabel=""
        {...facet(
          "type",
          types.map((t) => ({ value: t, label: t, icon: <TypeIcon type={t} withTooltip={false} /> })),
        )}
      />
      <FilterPopover
        title="Priority"
        icon={Gauge}
        align="start"
        emptyLabel=""
        {...facet(
          "priority",
          PRIORITIES.map((p) => ({ value: p, label: p, icon: <PriorityIcon priority={p} withTooltip={false} /> })),
        )}
      />
      <FilterPopover
        title="Assignee"
        icon={User}
        align="start"
        emptyLabel=""
        {...facet("assignee", [
          ...people.map((p) => ({ value: p.id, label: p.displayName })),
          { value: UNASSIGNED, label: "Unassigned" },
        ])}
      />
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            table.resetColumnFilters()
            table.setGlobalFilter("")
          }}
        >
          Reset
          <X />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="ml-auto h-8">
            <Settings2 />
            View
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {table
            .getAllLeafColumns()
            .filter((c) => c.getCanHide())
            .map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={c.getIsVisible()}
                onCheckedChange={(v) => c.toggleVisibility(Boolean(v))}
                onSelect={(e) => e.preventDefault()}
              >
                {COLUMN_LABELS[c.id] ?? c.id}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
