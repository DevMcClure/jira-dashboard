import { Placeholder } from "@/components/common/Placeholder"
import { PageHeader } from "@/components/layout/PageHeader"

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Current totals, sprint progress and recent ticket movement across the selected teams and sprints."
      />
      <Placeholder phase={3} />
    </>
  )
}
