import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { pluralize } from "@/lib/format"
import type { IssueObjectiveRowData } from "./issue-objective-row-data"
import { IssueObjectiveRow } from "./IssueObjectiveRow"

type Props = { title: string; description?: string; rows: IssueObjectiveRowData[] }

/** A card of Objective issues for one team (or the ART level). */
export function IssueObjectiveGroup({ title, description, rows }: Props) {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b pb-4 [.border-b]:pb-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description ? `${description} · ` : ""}
          {pluralize(rows.length, "objective")}
        </CardDescription>
      </CardHeader>
      <ul className="divide-y">
        {rows.map((r) => (
          <IssueObjectiveRow key={r.objective.key} row={r} />
        ))}
      </ul>
    </Card>
  )
}
