import { format } from "date-fns"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { pluralize } from "@/lib/format"
import { HISTORY_LEVEL_LABEL, type historyCoverage } from "@/lib/jira/flow"

/** How much flow history is behind the page, against the DX guidance on when trends become meaningful. */
export function HistoryMeter({ coverage }: { coverage: ReturnType<typeof historyCoverage> }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="h-8 gap-1.5 px-2.5 font-normal" tabIndex={0}>
          <History className="size-3.5" aria-hidden />
          {pluralize(coverage.weeks, "week")} of history · {HISTORY_LEVEL_LABEL[coverage.level]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-pretty">
        {coverage.since ? `Work in scope started from ${format(coverage.since, "d MMM yyyy")}; ${coverage.finished} items finished. ` : ""}
        Most teams see initial insights within 2–4 weeks of consistent measurement, and actionable patterns after 2–3 months.
      </TooltipContent>
    </Tooltip>
  )
}
