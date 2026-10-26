import { Link } from "react-router-dom"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Progress } from "@/components/ui/progress"
import { useData } from "@/hooks/useData"
import { epicProgress, objectiveIssues } from "@/lib/jira/metrics"
import type { Issue, Objective, ProgramIncrement } from "@/lib/jira/types"

type Props = { objective: Objective; pi: ProgramIncrement; issues: Issue[] }

/** An objective's linked epics with their progress and tickets, plus any directly linked tickets. */
export function ObjectiveEpics({ objective, pi, issues }: Props) {
  const { dataset } = useData()
  const tickets = objectiveIssues(objective, pi, issues)
  const progress = new Map(epicProgress(tickets).map((e) => [e.epicKey, e]))
  const direct = new Set(objective.issueKeys)
  const groups = [
    ...objective.epicKeys.map((key) => ({
      key,
      title: dataset.byKey.get(key)?.summary ?? key,
      tickets: tickets.filter((t) => t.epicKey === key && !direct.has(t.key)),
      pct: progress.get(key)?.pctDone ?? null,
    })),
    ...(direct.size
      ? [{ key: null, title: "Linked directly", tickets: tickets.filter((t) => direct.has(t.key)), pct: null }]
      : []),
  ]

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key ?? "direct"} className="space-y-2">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {g.title}
              {g.key && <span className="ml-2 font-mono text-xs text-muted-foreground">{g.key}</span>}
            </p>
            {g.pct !== null && (
              <div className="flex w-40 shrink-0 items-center gap-2">
                <Progress value={g.pct} className="h-1.5" aria-label={`${g.title}: ${g.pct}% done`} />
                <span className="w-9 text-right text-xs tabular-nums">{g.pct}%</span>
              </div>
            )}
          </div>
          {g.tickets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tickets in this PI for the current filters.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {g.tickets.map((t) => (
                <li key={t.key}>
                  <Link
                    to={`/tickets/${t.key}`}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{t.key}</span>
                    <span className="min-w-0 flex-1 truncate">{t.summary}</span>
                    <span className="hidden w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">
                      {t.storyPoints ?? "—"} pts
                    </span>
                    <StatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
