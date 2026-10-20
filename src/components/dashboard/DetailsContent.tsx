import { AssigneeChart } from "./AssigneeChart"
import { BurndownChart } from "./BurndownChart"
import { KpiRow } from "./KpiRow"
import { RecentMovements } from "./RecentMovements"
import { SprintHealthList } from "./SprintHealthList"
import { StatusDonut } from "./StatusDonut"

/** The Details dashboard body. Respects header filters, the period and any team scope. */
export function DetailsContent() {
  return (
    <>
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
