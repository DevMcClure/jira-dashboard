import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TicketFeatures, TicketRow } from "./table-setup"

type Props<TValue> = {
  column: Column<TicketFeatures, TicketRow, TValue>
  title: string
  align?: "left" | "right"
}

/** Uppercase, clickable column header with sort direction indicator. */
export function SortHeader<TValue>({ column, title, align = "left" }: Props<TValue>) {
  const sorted = column.getIsSorted()
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium tracking-wide uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        sorted && "text-foreground",
        align === "right" && "flex-row-reverse",
      )}
      aria-label={`Sort by ${title}`}
    >
      {title}
      <Icon className={cn("size-3", !sorted && "opacity-40")} aria-hidden />
    </button>
  )
}
