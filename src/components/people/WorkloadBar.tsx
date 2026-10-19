import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Workload } from "@/lib/jira/metrics"
import { CATEGORY_COLOR_VAR, CATEGORY_LABEL } from "@/lib/jira/constants"
import type { StatusCategory } from "@/lib/jira/types"

const ORDER: StatusCategory[] = ["done", "in_progress", "todo"]

/** Mini stacked bar (done / in progress / to do), scaled to the busiest person. */
export function WorkloadBar({ workload, max }: { workload: Workload; max: number }) {
  const width = max > 0 ? (workload.total / max) * 100 : 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-2.5 w-full items-center" aria-label="Ticket breakdown">
          <div className="flex h-full gap-0.5" style={{ width: `${width}%` }}>
            {ORDER.filter((c) => workload[c] > 0).map((c, i, all) => (
              <span
                key={c}
                className={i === all.length - 1 ? "h-full rounded-r-[3px]" : "h-full"}
                style={{ flexGrow: workload[c], backgroundColor: `var(${CATEGORY_COLOR_VAR[c]})` }}
              />
            ))}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="grid gap-1 tabular-nums">
          {ORDER.map((c) => (
            <span key={c} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: `var(${CATEGORY_COLOR_VAR[c]})` }} />
              {CATEGORY_LABEL[c]}: {workload[c]}
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
