import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/hooks/useData"
import { useStatusInfo } from "@/hooks/useStatusInfo"
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format"
import { issueTimeline } from "@jira-dashboard/core/metrics"
import type { Issue } from "@jira-dashboard/core/types"

/** Vertical changelog timeline: a dot per event, coloured by destination status. */
export function Timeline({ issue }: { issue: Issue }) {
  const { dataset } = useData()
  const statusInfo = useStatusInfo()
  const now = dataset.meta.generatedAt
  const name = (id: string | null) =>
    id ? (dataset.personById.get(id)?.displayName.split(" ")[0] ?? id) : "someone"
  const fullName = (id: string | null) => (id ? (dataset.personById.get(id)?.displayName ?? id) : "Unassigned")

  const items = issueTimeline(issue).map((e) => {
    let dot = "--muted-foreground"
    let text: ReactNode
    switch (e.kind) {
      case "created":
        dot = statusInfo("To Do").colorVar
        text = <>Created by {name(e.authorId)}</>
        break
      case "status":
        dot = statusInfo(e.to).colorVar
        text = (
          <>
            Moved{" "}
            <strong className="inline-flex items-center gap-1 font-medium text-foreground">
              {e.from ?? "—"} <ArrowRight className="size-3" aria-label="to" /> {e.to}
            </strong>{" "}
            by {name(e.authorId)}
            {e.from && (
              <span className="text-muted-foreground">
                {" "}
                · {formatDuration(e.msInPrevious)} in {e.from}
              </span>
            )}
          </>
        )
        break
      case "assignee":
        text = e.from ? (
          <>
            Reassigned from {fullName(e.from)} to <strong className="font-medium text-foreground">{fullName(e.to)}</strong>
          </>
        ) : (
          <>
            Assigned to <strong className="font-medium text-foreground">{fullName(e.to)}</strong>
            {e.authorId && e.authorId !== e.to && <> by {name(e.authorId)}</>}
          </>
        )
        break
    }
    return { at: e.at, dot, text, muted: e.kind === "assignee" }
  })

  return (
    <ol className="relative space-y-4">
      {/* Rail */}
      <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-px bg-border" />
      {items.map((item, i) => (
        <li key={i} className="relative flex gap-3 pl-6 text-sm">
          <span
            aria-hidden
            className="absolute top-1.5 left-0 size-[11px] rounded-full ring-4 ring-background"
            style={{ backgroundColor: `var(${item.dot})`, opacity: item.muted ? 0.6 : 1 }}
          />
          <p className="min-w-0 flex-1 text-muted-foreground">{item.text}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatRelative(item.at, now)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{formatDateTime(item.at)}</TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ol>
  )
}
