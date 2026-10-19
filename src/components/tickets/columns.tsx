import { createColumnHelper } from "@tanstack/react-table"
import { PersonAvatar } from "@/components/common/PersonAvatar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UNASSIGNED } from "@/components/filters/GlobalFilters"
import { DateCell } from "./DateCell"
import { PriorityIcon, TypeIcon } from "./IssueIcons"
import { SortHeader } from "./SortHeader"
import {
  inSet,
  sortByAssignee,
  sortByPriority,
  sortByStatus,
  type TicketFeatures,
  type TicketRow,
} from "./table-setup"

const h = createColumnHelper<TicketFeatures, TicketRow>()

/** Stable (module-scope) column definitions for the tickets table. */
export const ticketColumns = h.columns([
  h.accessor("key", {
    header: ({ column }) => <SortHeader column={column} title="Key" />,
    cell: ({ getValue }) => <span className="font-mono text-xs whitespace-nowrap">{getValue()}</span>,
    sortFn: "alphanumeric",
    enableHiding: false,
  }),
  h.accessor("summary", {
    header: ({ column }) => <SortHeader column={column} title="Summary" />,
    cell: ({ getValue }) => <span className="block max-w-[14rem] truncate xl:max-w-[24rem]" title={getValue()}>{getValue()}</span>,
    sortFn: "text",
    enableHiding: false,
  }),
  h.accessor("type", {
    header: ({ column }) => <SortHeader column={column} title="Type" />,
    cell: ({ getValue }) => <TypeIcon type={getValue()} />,
    filterFn: inSet,
    sortFn: "text",
  }),
  h.accessor("status", {
    header: ({ column }) => <SortHeader column={column} title="Status" />,
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    filterFn: inSet,
    sortFn: sortByStatus,
  }),
  h.accessor("priority", {
    header: ({ column }) => <SortHeader column={column} title="Priority" />,
    cell: ({ getValue }) => <PriorityIcon priority={getValue()} />,
    filterFn: inSet,
    sortFn: sortByPriority,
  }),
  h.accessor("assignee", {
    header: ({ column }) => <SortHeader column={column} title="Assignee" />,
    cell: ({ getValue }) => (
      <PersonAvatar
        personId={getValue() === UNASSIGNED ? null : getValue()}
        className="max-w-40 [&>span:last-child]:hidden xl:[&>span:last-child]:inline"
      />
    ),
    filterFn: inSet,
    sortFn: sortByAssignee,
  }),
  h.accessor("sprint", {
    header: ({ column }) => <SortHeader column={column} title="Sprint" />,
    cell: ({ getValue, row }) => (
      <span className="whitespace-nowrap">
        {getValue()}
        {row.original.sprintCount > 1 && (
          <span className="ml-1 text-xs text-muted-foreground" title="Carried over from an earlier sprint">
            +{row.original.sprintCount - 1}
          </span>
        )}
      </span>
    ),
    sortFn: "alphanumeric",
  }),
  h.accessor("storyPoints", {
    header: ({ column }) => <SortHeader column={column} title="Points" align="right" />,
    cell: ({ getValue }) => (
      <span className="block text-right tabular-nums">{getValue() ?? <span className="text-muted-foreground">—</span>}</span>
    ),
    sortFn: "basic",
    sortUndefined: "last",
  }),
  h.accessor("created", {
    header: ({ column }) => <SortHeader column={column} title="Created" />,
    cell: ({ getValue }) => <DateCell date={getValue()} />,
    sortFn: "datetime",
  }),
  h.accessor("updated", {
    header: ({ column }) => <SortHeader column={column} title="Updated" />,
    cell: ({ getValue }) => <DateCell date={getValue()} />,
    sortFn: "datetime",
  }),
  h.accessor("age", {
    header: ({ column }) => <SortHeader column={column} title="Age" align="right" />,
    cell: ({ getValue }) => <span className="block text-right text-muted-foreground tabular-nums">{getValue()}d</span>,
    sortFn: "basic",
  }),
])
