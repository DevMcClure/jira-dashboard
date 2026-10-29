import { StatusDot } from "@/components/common/StatusDot"
import { Card, CardContent } from "@/components/ui/card"
import type { StatusCategory } from "@jira-dashboard/core/types"
import type { IssueObjectiveRowData } from "./issue-objective-row-data"

const TILES: { category: StatusCategory; label: string; colorVar: string }[] = [
  { category: "todo", label: "To do", colorVar: "--status-todo" },
  { category: "in_progress", label: "In progress", colorVar: "--status-progress" },
  { category: "done", label: "Done", colorVar: "--status-done" },
]

/** How many Objective issues there are, by their own Jira status. */
export function IssueObjectiveTiles({ rows }: { rows: IssueObjectiveRowData[] }) {
  const tiles = [
    { label: "Objectives", value: rows.length, detail: "Objective issues", colorVar: undefined },
    ...TILES.map((t) => ({
      label: t.label,
      value: rows.filter((r) => r.objective.statusCategory === t.category).length,
      detail: "by the objective's own status",
      colorVar: t.colorVar,
    })),
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className="gap-0 py-5">
          <CardContent className="space-y-2 px-5">
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t.colorVar && <StatusDot colorVar={t.colorVar} />}
              {t.label}
            </p>
            <p className="text-3xl font-semibold tabular-nums">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
