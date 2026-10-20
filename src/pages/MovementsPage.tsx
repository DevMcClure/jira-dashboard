import { PageHeader } from "@/components/layout/PageHeader"
import { CreatedResolvedChart } from "@/components/movements/CreatedResolvedChart"
import { CumulativeFlowChart } from "@/components/movements/CumulativeFlowChart"
import { TransitionsPerDayChart } from "@/components/movements/TransitionsPerDayChart"
import { TransitionsTable } from "@/components/movements/TransitionsTable"
import { useFilteredIssues } from "@/hooks/useFilteredIssues"
import { useFilteredTransitions } from "@/hooks/useFilteredTransitions"
import { usePeriod } from "@/hooks/usePeriod"

export default function MovementsPage() {
  const issues = useFilteredIssues()
  const transitions = useFilteredTransitions()
  const { range, bucket, label } = usePeriod()

  return (
    <>
      <PageHeader
        title="Movements"
        description={`How tickets flow through the workflow · ${label}${bucket === "hour" ? ", by hour" : ""}. Change the period in the header.`}
      />
      <CumulativeFlowChart issues={issues} range={range} bucket={bucket} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CreatedResolvedChart issues={issues} range={range} bucket={bucket} />
        <TransitionsPerDayChart transitions={transitions} range={range} bucket={bucket} />
      </div>
      <TransitionsTable transitions={transitions} range={range} />
    </>
  )
}
