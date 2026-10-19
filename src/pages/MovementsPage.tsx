import { Placeholder } from "@/components/common/Placeholder"
import { PageHeader } from "@/components/layout/PageHeader"

export default function MovementsPage() {
  return (
    <>
      <PageHeader
        title="Movements"
        description="How tickets flow through the workflow over time."
      />
      <Placeholder phase={5} />
    </>
  )
}
