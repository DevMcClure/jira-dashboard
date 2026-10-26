import { format } from "date-fns"
import { useMemo } from "react"
import { AgingWipChart } from "@/components/flow/AgingWipChart"
import { CycleTimeScatter } from "@/components/flow/CycleTimeScatter"
import { DistributionChart } from "@/components/flow/DistributionChart"
import { EfficiencyChart } from "@/components/flow/EfficiencyChart"
import { FlowKpiRow } from "@/components/flow/FlowKpiRow"
import { PredictabilityChart } from "@/components/flow/PredictabilityChart"
import { ThroughputChart } from "@/components/flow/ThroughputChart"
import { TimeByStatusBar } from "@/components/flow/TimeByStatusBar"
import { WipChart } from "@/components/flow/WipChart"
import { PageHeader } from "@/components/layout/PageHeader"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useData } from "@/hooks/useData"
import { useFlowItems } from "@/hooks/useFlowItems"
import { useTimeMode } from "@/hooks/useTimeMode"
import {
  flowDistribution,
  flowEfficiency,
  flowLoad,
  flowPredictability,
  flowTime,
  flowVelocity,
} from "@/lib/jira/flow"
import type { TimeMode } from "@/lib/jira/working-time"

/**
 * The six SAFe flow metrics, in items and time rather than points. KPIs use the
 * header period; charts use it too but cover at least the last 8 weeks.
 */
export default function FlowPage() {
  const { dataset } = useData()
  const { items, sprints, range, chartRange, now, periodPhrase } = useFlowItems()
  const [mode, setMode] = useTimeMode()

  const m = useMemo(() => {
    const opts = { mode, now }
    return {
      kpi: {
        velocity: flowVelocity(items, range),
        time: flowTime(items, range, opts),
        efficiency: flowEfficiency(items, range, opts),
        distribution: flowDistribution(items, sprints, range, opts),
      },
      chart: {
        velocity: flowVelocity(items, chartRange),
        time: flowTime(items, chartRange, opts),
        load: flowLoad(items, chartRange, opts),
        efficiency: flowEfficiency(items, chartRange, opts),
      },
      predictability: flowPredictability(dataset.programIncrements),
    }
  }, [items, sprints, range, chartRange, now, mode, dataset])

  const windowLabel = `since ${format(chartRange.start, "d MMM")}`

  return (
    <>
      <PageHeader
        title="Flow"
        description="How work flows: items finished, how long they take, what's in progress and where the time goes. Counts items, not points."
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={mode}
            onValueChange={(v) => v && setMode(v as TimeMode)}
            aria-label="Time measured in"
          >
            <ToggleGroupItem value="working" className="px-3">
              Working hours
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" className="px-3">
              Calendar time
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <FlowKpiRow
        {...m.kpi}
        load={m.chart.load}
        predictability={m.predictability}
        periodPhrase={periodPhrase}
        mode={mode}
      />
      <AgingWipChart aging={m.chart.load.aging} cycle={m.chart.time.cycle} mode={mode} windowLabel={windowLabel} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ThroughputChart perWeek={m.chart.velocity.perWeek} windowLabel={windowLabel} />
        <CycleTimeScatter points={m.chart.time.points} cycle={m.chart.time.cycle} mode={mode} windowLabel={windowLabel} />
        <WipChart daily={m.chart.load.daily} windowLabel={windowLabel} />
        <EfficiencyChart efficiency={m.chart.efficiency} mode={mode} windowLabel={windowLabel} />
      </div>
      <TimeByStatusBar byStatus={m.chart.efficiency.byStatus} mode={mode} windowLabel={windowLabel} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionChart perSprint={m.kpi.distribution.perSprint} />
        <PredictabilityChart rows={m.predictability} />
      </div>
      <p className="text-xs text-muted-foreground">
        Statuses count as <strong className="font-medium">active</strong> (In Progress, QA) or{" "}
        <strong className="font-medium">waiting</strong> (In Review, Blocked). Working hours are Mon–Fri 09:00–18:00
        London time; a working day is 9 hours. Epics and sub-tasks aren't counted as items.
      </p>
    </>
  )
}
