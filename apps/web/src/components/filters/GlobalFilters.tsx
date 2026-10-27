import { Timer, User, Users } from "lucide-react"
import { useMemo } from "react"
import { useData } from "@/hooks/useData"
import { useScope } from "@/hooks/useScope"
import { FilterPopover, type FilterOption } from "./FilterPopover"

export const UNASSIGNED = "__unassigned__"

// Below 1280px the header only has room for each filter's icon and value.
const TITLE_CLASS = "hidden xl:inline"

/** Header filter bar: Sprints, Teams, Assignees (empty selection = All). */
export function GlobalFilters({ disabled = false }: { disabled?: boolean }) {
  const { dataset, filters, setFilters } = useData()
  const { historySprints } = useScope()

  const options = useMemo(() => {
    // Sprints of the PI in view (all sprints when the export has no PIs).
    const sprints: FilterOption[] = historySprints.map((s) => ({
      value: String(s.id),
      label: s.name,
      group: (s.teamId && dataset.teamById.get(s.teamId)?.name) || "Other",
    }))
    const teams: FilterOption[] = dataset.teams.map((t) => ({ value: t.id, label: t.name }))
    const assigneeIds = new Set(dataset.issues.map((i) => i.assigneeId))
    const assignees: FilterOption[] = [
      ...dataset.people
        .filter((p) => assigneeIds.has(p.id))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((p) => ({ value: p.id, label: p.displayName })),
      ...(assigneeIds.has(null) ? [{ value: UNASSIGNED, label: "Unassigned" }] : []),
    ]
    return { sprints, teams, assignees }
  }, [dataset, historySprints])

  return (
    <div className="flex items-center gap-2">
      <FilterPopover
        title="Sprints"
        icon={Timer}
        options={options.sprints}
        selected={filters.sprintIds.map(String)}
        onChange={(v) => setFilters({ ...filters, sprintIds: v.map(Number) })}
        disabled={disabled}
        titleClassName={TITLE_CLASS}
      />
      <FilterPopover
        title="Teams"
        icon={Users}
        options={options.teams}
        selected={filters.teamIds}
        onChange={(v) => setFilters({ ...filters, teamIds: v })}
        disabled={disabled}
        titleClassName={TITLE_CLASS}
      />
      <FilterPopover
        title="Assignees"
        icon={User}
        options={options.assignees}
        selected={filters.assigneeIds.map((id) => id ?? UNASSIGNED)}
        onChange={(v) => setFilters({ ...filters, assigneeIds: v.map((id) => (id === UNASSIGNED ? null : id)) })}
        disabled={disabled}
        titleClassName={TITLE_CLASS}
      />
    </div>
  )
}
