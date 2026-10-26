import { Layers } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useData } from "@/hooks/useData"
import { SPRINT_SCOPE } from "@/lib/jira/scope"

const SPRINT = "__sprint__"

/** Header scope control: the current sprint, or one whole PI. Hidden when the export has no PIs. */
export function ScopePicker({ disabled = false }: { disabled?: boolean }) {
  const { dataset, scope, setScope, filters, setFilters, setBurndownSprintId } = useData()
  const pis = dataset.programIncrements
  if (!pis.length) return null

  const onChange = (v: string) => {
    setScope(v === SPRINT ? SPRINT_SCOPE : { kind: "pi", piId: v })
    // Picked sprints belong to the previous scope's PI.
    setFilters({ ...filters, sprintIds: [] })
    setBurndownSprintId(null)
  }

  return (
    <Select value={scope.kind === "pi" ? scope.piId : SPRINT} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger size="sm" className="h-8 gap-1.5" aria-label="Scope">
        <Layers className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={SPRINT}>Current sprint</SelectItem>
        <SelectSeparator />
        {[...pis].reverse().map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
            {p.state === "active" && <span className="text-muted-foreground">· current</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
