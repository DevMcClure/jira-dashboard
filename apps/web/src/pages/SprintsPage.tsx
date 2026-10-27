import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { SprintCard, type SprintStats } from "@/components/sprints/SprintCard"
import { useAppPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import { useHistoryIssues } from "@/hooks/useFilteredIssues"
import { useHistorySprints } from "@/hooks/useScopedSprints"
import { countByStatus, scopeChange, sprintHealth } from "@jira-dashboard/core/metrics"
import type { Sprint } from "@jira-dashboard/core/types"

const SECTIONS: { state: Sprint["state"]; title: string }[] = [
  { state: "active", title: "Active" },
  { state: "future", title: "Upcoming" },
  { state: "closed", title: "Closed" },
]

export default function SprintsPage() {
  const { dataset, filters, setFilters, setBurndownSprintId } = useData()
  const issues = useHistoryIssues()
  const sprints = useHistorySprints()
  const navigate = useNavigate()
  const to = useAppPath()
  const now = dataset.meta.generatedAt

  const stats = useMemo(() => {
    const map = new Map<number, SprintStats>()
    for (const s of sprints) {
      const inSprint = issues.filter((i) => i.sprintIds.includes(s.id))
      map.set(s.id, {
        health: sprintHealth(s, issues, now),
        scope: scopeChange(s, issues),
        statuses: countByStatus(inSprint),
        ticketCount: inSprint.length,
      })
    }
    return map
  }, [sprints, issues, now])

  const open = (s: Sprint) => {
    setBurndownSprintId(s.id)
    setFilters({ ...filters, sprintIds: [s.id] })
    navigate(to("/tickets"))
  }

  return (
    <>
      <PageHeader
        title="Sprints"
        description="Progress, scope change and health for each sprint. Click a sprint to see its tickets."
      />
      {sprints.length === 0 && <EmptyState className="h-40">No sprints for the current filters.</EmptyState>}
      {SECTIONS.map(({ state, title }) => {
        const list = sprints
          .filter((s) => s.state === state)
          .sort((a, b) =>
            state === "closed"
              ? (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0)
              : (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0),
          )
        if (list.length === 0) return null
        return (
          <section key={state} className="space-y-3">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((s) => (
                <SprintCard
                  key={s.id}
                  sprint={s}
                  teamName={s.teamId ? dataset.teamById.get(s.teamId)?.name : undefined}
                  stats={stats.get(s.id)!}
                  onOpen={() => open(s)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
