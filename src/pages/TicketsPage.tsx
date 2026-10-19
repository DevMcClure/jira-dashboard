import { Placeholder } from "@/components/common/Placeholder"
import { PageHeader } from "@/components/layout/PageHeader"

export default function TicketsPage() {
  return (
    <>
      <PageHeader
        title="Tickets"
        description="Every ticket in the selected teams and sprints, with its full movement history."
      />
      <Placeholder phase={4} />
    </>
  )
}
