import { Placeholder } from "@/components/common/Placeholder"
import { PageHeader } from "@/components/layout/PageHeader"

export default function TeamsPage() {
  return (
    <>
      <PageHeader
        title="Teams"
        description="Remaining work and velocity for each team."
      />
      <Placeholder phase={5} />
    </>
  )
}
