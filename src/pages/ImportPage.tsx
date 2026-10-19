import { Placeholder } from "@/components/common/Placeholder"
import { PageHeader } from "@/components/layout/PageHeader"

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import"
        description="Load a Jira Trawler JSON export to replace the sample data."
      />
      <Placeholder phase={6} />
    </>
  )
}
