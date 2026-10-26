import { format } from "date-fns"
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { PersonAvatar } from "@/components/common/PersonAvatar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useData } from "@/hooks/useData"
import { formatDuration } from "@/lib/format"
import { cycleTimeDays, ticketAgeDays, timeInCurrentStatus } from "@jira-dashboard/core/metrics"
import { FlowBlock } from "./FlowBlock"
import { PriorityIcon, TypeIcon } from "./IssueIcons"
import { Timeline } from "./Timeline"

type Props = { issueKey?: string; onClose: () => void }

/** Right-hand detail sheet for one ticket, driven by the /tickets/:key route. */
export function TicketSheet({ issueKey, onClose }: Props) {
  const { dataset } = useData()
  const issue = issueKey ? dataset.byKey.get(issueKey) : undefined

  return (
    <Sheet open={Boolean(issueKey)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-[560px]">
        {!issue ? (
          <SheetHeader>
            <SheetTitle>Ticket not found</SheetTitle>
            <SheetDescription>
              <span className="font-mono">{issueKey}</span> isn't in the loaded data.
            </SheetDescription>
          </SheetHeader>
        ) : (
          <TicketDetail issueKey={issue.key} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function TicketDetail({ issueKey }: { issueKey: string }) {
  const { dataset } = useData()
  const issue = dataset.byKey.get(issueKey)!
  const now = dataset.meta.generatedAt
  const team = issue.teamId ? dataset.teamById.get(issue.teamId)?.name : undefined
  const sprints = issue.sprintIds.map((id) => dataset.sprintById.get(id)?.name ?? `Sprint ${id}`)
  const cycle = cycleTimeDays(issue)
  const jiraUrl = dataset.meta.jiraBaseUrl ? `${dataset.meta.jiraBaseUrl.replace(/\/$/, "")}/browse/${issue.key}` : null

  const meta: { label: string; value: ReactNode }[] = [
    { label: "Assignee", value: <PersonAvatar personId={issue.assigneeId} /> },
    { label: "Reporter", value: <PersonAvatar personId={issue.reporterId} /> },
    {
      label: "Type",
      value: (
        <span className="flex items-center gap-2">
          <TypeIcon type={issue.type} withTooltip={false} /> {issue.type}
        </span>
      ),
    },
    {
      label: "Priority",
      value: (
        <span className="flex items-center gap-2">
          <PriorityIcon priority={issue.priority ?? "Medium"} withTooltip={false} /> {issue.priority ?? "—"}
        </span>
      ),
    },
    { label: "Story points", value: issue.storyPoints ?? "—" },
    { label: "Team", value: team ?? "—" },
    { label: "Sprint", value: sprints.length ? sprints.join(" → ") : "—" },
    { label: "Epic", value: issue.epicKey ? <span className="font-mono text-xs">{issue.epicKey}</span> : "—" },
    { label: "Created", value: format(issue.created, "d MMM yyyy") },
    { label: "Updated", value: format(issue.updated, "d MMM yyyy") },
    { label: "Resolved", value: issue.resolved ? format(issue.resolved, "d MMM yyyy") : "—" },
    { label: "Due", value: issue.dueDate ? format(issue.dueDate, "d MMM yyyy") : "—" },
    { label: "Age", value: `${ticketAgeDays(issue, now)} days` },
    { label: "Cycle time", value: cycle === null ? "—" : `${cycle.toFixed(1)} days` },
  ]

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-6">
        <SheetHeader className="gap-3 p-0 pr-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TypeIcon type={issue.type} />
            <span className="font-mono">{issue.key}</span>
          </div>
          <SheetTitle className="text-lg leading-snug">{issue.summary}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={issue.status} />
              {issue.statusCategory !== "done" && (
                <span className="text-xs tabular-nums">
                  for {formatDuration(timeInCurrentStatus(issue, now))}
                </span>
              )}
              {jiraUrl && (
                <Button variant="link" size="sm" className="ml-auto h-auto p-0" asChild>
                  <a href={jiraUrl} target="_blank" rel="noreferrer">
                    Open in Jira <ExternalLink />
                  </a>
                </Button>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {meta.map(({ label, value }) => (
            <div key={label} className="min-w-0 space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
              <dd className="truncate tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issue.labels.map((l) => (
              <Badge key={l} variant="secondary" className="font-normal">
                {l}
              </Badge>
            ))}
          </div>
        )}

        <Separator />

        <section className="space-y-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Description</h3>
          {issue.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{issue.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description.</p>
          )}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Flow</h3>
          <FlowBlock issue={issue} />
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">History</h3>
          <Timeline issue={issue} />
        </section>
      </div>
    </ScrollArea>
  )
}
