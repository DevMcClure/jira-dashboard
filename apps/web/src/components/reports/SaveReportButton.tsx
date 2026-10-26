import { BookmarkPlus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/hooks/useData"
import { usePeriod } from "@/hooks/usePeriod"
import { useReportMode } from "@/hooks/useReportMode"
import { SaveReportDialog } from "./SaveReportDialog"

/** Header action: save the current filters, scope and period as a report. Hidden inside a report. */
export function SaveReportButton() {
  const report = useReportMode()
  const { dataset, filters, scope, period } = useData()
  const { range } = usePeriod()
  const [open, setOpen] = useState(false)
  if (report) return null
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)} aria-label="Save as report">
            <BookmarkPlus />
            <span className="hidden 2xl:inline">Save as report</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save this view as a report</TooltipContent>
      </Tooltip>
      <SaveReportDialog
        open={open}
        onOpenChange={setOpen}
        view={{ filters, scope, period, range, generatedAt: dataset.meta.generatedAt }}
      />
    </>
  )
}
