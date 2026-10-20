import { AssigneeChart } from "@/components/dashboard/AssigneeChart"
import { BurndownChart } from "@/components/dashboard/BurndownChart"
import { KpiRow } from "@/components/dashboard/KpiRow"
import { RecentMovements } from "@/components/dashboard/RecentMovements"
import { SprintHealthList } from "@/components/dashboard/SprintHealthList"
import { StatusDonut } from "@/components/dashboard/StatusDonut"
import { PageHeader } from "@/components/layout/PageHeader"

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Current totals, sprint progress and recent ticket movement across the selected teams and sprints."
      />
      <KpiRow />
      <div className="grid gap-4 lg:grid-cols-3">
        <BurndownChart />
        <StatusDonut />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <RecentMovements />
        <SprintHealthList />
      </div>
      <AssigneeChart />
    </>
  )
}
