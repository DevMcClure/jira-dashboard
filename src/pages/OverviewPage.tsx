import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { TeamCard } from "@/components/teams/TeamCard"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { useFilteredTransitions } from "@/hooks/useFilteredTransitions"
import { usePeriod } from "@/hooks/usePeriod"

export default function OverviewPage() {
  const { dataset, filters } = useData()
  const issues = useFilteredIssues()
  const transitions = useFilteredTransitions()
  const { range, label } = usePeriod()
  const teams = filters.teamIds.length ? dataset.teams.filter((t) => filters.teamIds.includes(t.id)) : dataset.teams

  return (
    <>
      <PageHeader
        title="Overview"
        description="Every team at a glance. Select a team to see its details."
      />
      {teams.length === 0 ? (
        <EmptyState className="h-40">No teams in this export.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} issues={issues} transitions={transitions} range={range} periodLabel={label} />
          ))}
        </div>
      )}
    </>
  )
}
