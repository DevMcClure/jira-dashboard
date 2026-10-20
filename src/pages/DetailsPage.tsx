import { DetailsContent } from "@/components/dashboard/DetailsContent"
import { PageHeader } from "@/components/layout/PageHeader"

export default function DetailsPage() {
  return (
    <>
      <PageHeader
        title="Details"
        description="Current totals, sprint progress and recent ticket movement across the selected teams and sprints."
      />
      <DetailsContent />
    </>
  )
}
