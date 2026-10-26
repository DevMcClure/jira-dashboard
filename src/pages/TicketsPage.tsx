import { useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/PageHeader"
import { TicketSheet } from "@/components/tickets/TicketSheet"
import { TicketsTable } from "@/components/tickets/TicketsTable"
import { toTicketRows } from "@/components/tickets/table-setup"
import { useAppPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"

export default function TicketsPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const to = useAppPath()
  const { dataset } = useData()
  const issues = useFilteredIssues()
  const rows = useMemo(() => toTicketRows(issues, dataset), [issues, dataset])

  return (
    <>
      <PageHeader
        title="Tickets"
        description="Every ticket in the selected teams and sprints, with its full movement history."
      />
      <TicketsTable rows={rows} activeKey={key} />
      <TicketSheet issueKey={key} onClose={() => navigate(to("/tickets"))} />
    </>
  )
}
