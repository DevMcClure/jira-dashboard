import { ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import { PersonAvatar } from "@/components/common/PersonAvatar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { useAppPath } from "@/hooks/useAppPath"
import { pluralize } from "@/lib/format"
import type { IssueObjectiveRowData } from "./issue-objective-row-data"
import { ObjectiveEpics } from "./ObjectiveEpics"

/** One Objective issue: its PI, Jira status, owner and progress from its epics' tickets. Expands to its epics. */
export function IssueObjectiveRow({ row }: { row: IssueObjectiveRowData }) {
  const { objective: o, epicKeys, piName, tickets, progress } = row
  const to = useAppPath()

  return (
    <Collapsible asChild>
      <li className="group/row">
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_12rem_auto]">
          <div className="min-w-0 space-y-1.5">
            <CollapsibleTrigger className="flex max-w-full items-center gap-1.5 text-left text-sm font-semibold hover:underline focus-visible:underline focus-visible:outline-none">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/row:rotate-90" />
              <span className="truncate">{o.summary}</span>
            </CollapsibleTrigger>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5.5 text-xs text-muted-foreground">
              <Link to={to(`/tickets/${o.key}`)} className="font-mono hover:underline">
                {o.key}
              </Link>
              <Badge variant="outline" className="font-normal">
                {piName ?? "No PI"}
              </Badge>
              <PersonAvatar personId={o.assigneeId} />
              <span>{pluralize(epicKeys.length, "epic")}</span>
            </div>
          </div>

          <div className="col-span-2 space-y-1.5 lg:col-span-1">
            <div className="flex justify-between text-xs tabular-nums">
              <span className="text-muted-foreground">
                {progress.byPoints ? `${progress.donePoints} / ${progress.totalPoints} pts` : `${progress.done} / ${progress.total} tickets`}
              </span>
              <span className="font-medium">{progress.total ? `${progress.pctDone}%` : "—"}</span>
            </div>
            <Progress value={progress.pctDone} className="h-2" aria-label={`${o.summary}: ${progress.pctDone}% done`} />
          </div>

          <StatusBadge status={o.status} className="justify-self-end" />
        </div>
        <CollapsibleContent className="border-t bg-muted/20 px-6 py-4">
          {epicKeys.length ? (
            <ObjectiveEpics epicKeys={epicKeys} tickets={tickets} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No epics linked yet. Link one by its Epic Link field or a “relates to” link.
            </p>
          )}
        </CollapsibleContent>
      </li>
    </Collapsible>
  )
}
