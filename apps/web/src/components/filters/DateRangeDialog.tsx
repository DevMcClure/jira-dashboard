import { differenceInCalendarDays, format } from "date-fns"
import { useState } from "react"
import type { DateRange as PickedRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { pluralize } from "@/lib/format"
import type { DayRange } from "@jira-dashboard/core/period"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dates to start from (the current custom range, if any). */
  initial: DayRange | null
  /** Earliest and latest selectable days: the data's start and the export's "now". */
  min: Date
  max: Date
  onApply: (range: DayRange) => void
}

/** Pick a custom period: two whole days, inclusive, within the data's span. */
export function DateRangeDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[calc(100vw-2rem)] sm:max-w-fit">
        {/* Remounted on each open so the picker starts from the current range. */}
        {open && <RangeForm {...rest} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function RangeForm({ initial, min, max, onApply, onDone }: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const [picked, setPicked] = useState<PickedRange | undefined>(initial ? { from: initial.from, to: initial.to } : undefined)
  const complete = picked?.from && picked.to
  const days = complete ? differenceInCalendarDays(picked.to!, picked.from!) + 1 : 0
  // Open on the month before the latest day, so the newest data is in view.
  const month = picked?.from ?? new Date(max.getFullYear(), max.getMonth() - 1, 1)

  return (
    <>
      <DialogHeader>
        <DialogTitle>Custom range</DialogTitle>
        <DialogDescription>Whole days, from the start of the first to the end of the last.</DialogDescription>
      </DialogHeader>
      <Calendar
        mode="range"
        numberOfMonths={2}
        defaultMonth={month}
        selected={picked}
        onSelect={setPicked}
        disabled={[{ before: min }, { after: max }]}
        startMonth={min}
        endMonth={max}
        className="mx-auto rounded-lg border"
      />
      <DialogFooter className="items-center sm:justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          {complete
            ? `${pluralize(days, "day")}: ${format(picked.from!, "d MMM")} – ${format(picked.to!, "d MMM yyyy")}`
            : picked?.from
              ? "Pick the last day"
              : "Pick the first day"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={!complete}
            onClick={() => {
              onApply({ from: picked!.from!, to: picked!.to! })
              onDone()
            }}
          >
            Apply
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
