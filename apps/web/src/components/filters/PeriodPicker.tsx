import { format } from "date-fns"
import { CalendarDays, CalendarRange } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/hooks/useData"
import { usePeriod } from "@/hooks/usePeriod"
import { PERIODS, periodRange, type Period } from "@jira-dashboard/core/period"
import { DateRangeDialog } from "./DateRangeDialog"

/** Header time-period control. Defaults to Today; drives every activity view. "Custom range…" opens a calendar. */
export function PeriodPicker({ disabled = false }: { disabled?: boolean }) {
  const { dataset, period, setPeriod, customDates, setCustomDates, fixedRange } = useData()
  const { range } = usePeriod()
  const [picking, setPicking] = useState(false)
  // "This PI" only means something when the export has PIs.
  const periods = dataset.programIncrements.length ? PERIODS : PERIODS.filter((p) => p.value !== "pi")
  const now = dataset.meta.generatedAt
  const earliest = periodRange("all", now, dataset.sprints, dataset.issues).start
  const showDates = fixedRange !== null || period === "custom"

  const onChange = (v: string) => {
    // Custom only takes effect once dates are applied.
    if (v === "custom") setPicking(true)
    else setPeriod(v as Period)
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={period} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger size="sm" className="h-8 gap-1.5" aria-label="Time period">
          <CalendarDays className="size-3.5" />
          {/* Custom ranges and frozen reports show their dates rather than a preset's name. */}
          {showDates ? (
            <span className="tabular-nums">{`${format(range.start, "d MMM")} – ${format(range.end, "d MMM")}`}</span>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent align="end">
          {periods.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period === "custom" && !disabled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setPicking(true)} aria-label="Change dates">
              <CalendarRange className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Change dates</TooltipContent>
        </Tooltip>
      )}
      <DateRangeDialog
        open={picking}
        onOpenChange={setPicking}
        initial={customDates}
        min={earliest}
        max={now}
        onApply={(dates) => {
          setCustomDates(dates)
          setPeriod("custom")
        }}
      />
    </div>
  )
}
