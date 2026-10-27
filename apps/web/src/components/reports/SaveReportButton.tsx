import { BookmarkPlus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useData } from "@/hooks/useData"
import { DATA_MODE } from "@/lib/data/data-mode"
import { usePeriod } from "@/hooks/usePeriod"
import { useReportMode } from "@/hooks/useReportMode"
import { SaveReportDialog } from "./SaveReportDialog"

/** Header action: save the current filters, scope and period as a report. Hidden inside a report. */
export function SaveReportButton() {
  const report = useReportMode()
  const { dataset, filters, scope, period, asOf } = useData()
  // With the server, saving (and sharing) reports is for authors; viewers receive them.
  const isAuthor = useCurrentUser()?.roles.includes("author") ?? false
  const blocked = asOf ? "Go back to now to save a report" : DATA_MODE === "api" && !isAuthor ? "Only authors can save reports" : null
  const { range } = usePeriod()
  const [open, setOpen] = useState(false)
  if (report) return null
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A disabled button gets no pointer events, so the tooltip hangs on a wrapper. */}
          <span tabIndex={blocked ? 0 : undefined}>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)} disabled={blocked !== null} aria-label="Save as report">
              <BookmarkPlus />
              <span className="hidden 2xl:inline">Save as report</span>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{blocked ?? "Save this view as a report"}</TooltipContent>
      </Tooltip>
      <SaveReportDialog
        open={open}
        onOpenChange={setOpen}
        view={{ filters, scope, period, range, generatedAt: dataset.meta.generatedAt }}
      />
    </>
  )
}
