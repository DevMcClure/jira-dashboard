import { Placeholder } from "@/components/common/Placeholder"
import { PageHeader } from "@/components/layout/PageHeader"

export default function SprintsPage() {
  return (
    <>
      <PageHeader
        title="Sprints"
        description="Progress, scope change and health for each sprint."
      />
      <Placeholder phase={5} />
    </>
  )
}
