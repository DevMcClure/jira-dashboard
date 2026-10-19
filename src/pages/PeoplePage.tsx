import { Placeholder } from "@/components/common/Placeholder"
import { PageHeader } from "@/components/layout/PageHeader"

export default function PeoplePage() {
  return (
    <>
      <PageHeader
        title="People"
        description="Who is working on what, sorted by open workload."
      />
      <Placeholder phase={5} />
    </>
  )
}
