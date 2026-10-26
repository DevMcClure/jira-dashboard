import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { pluralize } from "@/lib/format"
import type { Issue, ProgramIncrement } from "@/lib/jira/types"
import type { ObjectiveRowData } from "./objective-row-data"
import { ObjectiveRow } from "./ObjectiveRow"

type Props = {
  title: string
  description?: string
  rows: ObjectiveRowData[]
  pi: ProgramIncrement
  issues: Issue[]
  onOpenBurnup: (objectiveId: string) => void
}

/** A card of objectives for one team (or the ART level). */
export function ObjectiveGroup({ title, description, rows, pi, issues, onOpenBurnup }: Props) {
  const committed = rows.filter((r) => r.objective.committed).length
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b pb-4 [.border-b]:pb-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description ? `${description} · ` : ""}
          {pluralize(committed, "committed objective")}
          {rows.length > committed && `, ${rows.length - committed} uncommitted`}
        </CardDescription>
      </CardHeader>
      <ul className="divide-y">
        {rows.map((r) => (
          <ObjectiveRow
            key={r.objective.id}
            row={r}
            pi={pi}
            issues={issues}
            onOpenBurnup={() => onOpenBurnup(r.objective.id)}
          />
        ))}
      </ul>
    </Card>
  )
}
