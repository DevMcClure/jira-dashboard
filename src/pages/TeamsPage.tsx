import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { TeamCard } from "@/components/teams/TeamCard"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"

export default function TeamsPage() {
  const { dataset, filters } = useData()
  const issues = useFilteredIssues()
  const teams = filters.teamIds.length ? dataset.teams.filter((t) => filters.teamIds.includes(t.id)) : dataset.teams

  return (
    <>
      <PageHeader title="Teams" description="Remaining work, velocity and members for each team." />
      {teams.length === 0 ? (
        <EmptyState className="h-40">No teams in this export.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} issues={issues} />
          ))}
        </div>
      )}
    </>
  )
}
