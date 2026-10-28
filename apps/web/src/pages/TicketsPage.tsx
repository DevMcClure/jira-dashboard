import { useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/PageHeader"
import { TicketSheet } from "@/components/tickets/TicketSheet"
import { TicketsTable } from "@/components/tickets/TicketsTable"
import { toTicketRows } from "@/components/tickets/table-setup"
import { useAppPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import { useEffectiveFilters } from "@/hooks/useEffectiveFilters"
import { matchesFilters, useFilteredIssues } from "@/hooks/useFilteredIssues"
import { withEpics } from "@jira-dashboard/core/scope"

export default function TicketsPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const to = useAppPath()
  const { dataset } = useData()
  const issues = useFilteredIssues()
  const filters = useEffectiveFilters()
  // Epics come in through their stories; the team/assignee filters still apply to them.
  const rows = useMemo(() => {
    const epicFilters = { ...filters, sprintIds: [] }
    const listed = withEpics(issues, dataset).filter((i) => i.type !== "Epic" || matchesFilters(i, epicFilters))
    return toTicketRows(listed, dataset)
  }, [issues, dataset, filters])

  return (
    <>
      <PageHeader
        title="Issues"
        description="Every issue in the selected teams and sprints, plus their epics, each with its full movement history."
      />
      <TicketsTable rows={rows} activeKey={key} />
      <TicketSheet issueKey={key} onClose={() => navigate(to("/tickets"))} />
    </>
  )
}
