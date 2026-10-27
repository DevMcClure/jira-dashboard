import { format } from "date-fns"
import { History, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/hooks/useData"
import { asOfBounds } from "@/lib/data/as-of"

/**
 * Header control (api mode): show the dashboard as it was at the end of a past
 * day, replayed from the changelog. Hidden in the static build and in reports.
 */
export function AsOfPicker() {
  const { liveDataset, asOf, setAsOf } = useData()
  const [open, setOpen] = useState(false)
  const bounds = useMemo(() => asOfBounds(liveDataset), [liveDataset])
  if (!setAsOf || !bounds) return null

  const calendar = (
    <PopoverContent className="w-auto p-0" align="end">
      <div className="border-b px-3 py-2 text-xs text-muted-foreground">Show the dashboard as it was at the end of a day</div>
      <Calendar
        mode="single"
        selected={asOf ?? undefined}
        defaultMonth={asOf ?? bounds.last}
        onSelect={(day) => {
          if (!day) return
          setAsOf(day)
          setOpen(false)
        }}
        disabled={[{ before: bounds.first }, { after: bounds.last }]}
        startMonth={bounds.first}
        endMonth={bounds.last}
      />
    </PopoverContent>
  )

  if (!asOf) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8" aria-label="Show a past day">
                <History />
                <span className="hidden 2xl:inline">As of…</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Show a past day</TooltipContent>
        </Tooltip>
        {calendar}
      </Popover>
    )
  }

  return (
    <div className="flex h-8 items-center rounded-md border border-primary/40 bg-primary/10 text-sm">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-full rounded-r-none px-2.5 font-medium" aria-label={`Showing ${format(asOf, "d MMMM yyyy")}; change the day`}>
            <History />
            <span className="hidden xl:inline">As of</span> {format(asOf, "d MMM")}
          </Button>
        </PopoverTrigger>
        {calendar}
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 rounded-l-none" onClick={() => setAsOf(null)} aria-label="Back to now">
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Back to now</TooltipContent>
      </Tooltip>
    </div>
  )
}
