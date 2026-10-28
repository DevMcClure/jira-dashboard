import { format } from "date-fns"
import { useMemo, type ReactNode } from "react"
import { AgingWipChart } from "@/components/flow/AgingWipChart"
import { DefectDebtInOut } from "@/components/flow/DefectDebtInOut"
import { DistributionChart } from "@/components/flow/DistributionChart"
import { DistributionNow } from "@/components/flow/DistributionNow"
import { EfficiencyChart } from "@/components/flow/EfficiencyChart"
import { FlowKpiRow } from "@/components/flow/FlowKpiRow"
import { FlowPrimaryTiles } from "@/components/flow/FlowPrimaryTiles"
import { FlowTimeScatter } from "@/components/flow/FlowTimeScatter"
import { HistoryMeter } from "@/components/flow/HistoryMeter"
import { MeasurementNotes } from "@/components/flow/MeasurementNotes"
import { MoreDetail } from "@/components/flow/MoreDetail"
import { PredictabilityChart } from "@/components/flow/PredictabilityChart"
import { SizeMixChart } from "@/components/flow/SizeMixChart"
import { SpeedVsThroughput } from "@/components/flow/SpeedVsThroughput"
import { TeamFlowTable } from "@/components/flow/TeamFlowTable"
import { TimeByStatusBar } from "@/components/flow/TimeByStatusBar"
import { WaitingNow } from "@/components/flow/WaitingNow"
import { WipChart } from "@/components/flow/WipChart"
import { WipExperimentChart } from "@/components/flow/WipExperimentChart"
import { PageHeader } from "@/components/layout/PageHeader"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useData } from "@/hooks/useData"
import { useEffectiveFilters } from "@/hooks/useEffectiveFilters"
import { useFlowItems } from "@/hooks/useFlowItems"
import { useFlowTimeBasis } from "@/hooks/useFlowTimeBasis"
import { useTimeMode } from "@/hooks/useTimeMode"
import {
  flowDistribution,
  flowEfficiency,
  flowInOut,
  flowLoad,
  flowPredictability,
  flowTime,
  flowTimeByWeek,
  flowTimePercentiles,
  flowVelocity,
  historyCoverage,
  sizeMix,
  teamFlow,
  waitingNow,
  weeklyLoad,
  type FlowTimeBasis,
} from "@jira-dashboard/core/flow"
import type { TimeMode } from "@jira-dashboard/core/working-time"

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/**
 * The six SAFe flow metrics, in items and time rather than points. Work mix
 * (distribution) and wait states (efficiency) lead, then speed and load
 * (decision 0047); one view per question, with charts that repeat them folded
 * into More detail (0044). KPIs use the header period; charts use it too but
 * cover at least the last 8 weeks.
 */
export default function FlowPage() {
  const { dataset } = useData()
  const { teamIds } = useEffectiveFilters()
  const { items, cfg, sprints, range, chartRange, now, periodPhrase } = useFlowItems()
  const [mode, setMode] = useTimeMode()
  const [basis, setBasis] = useFlowTimeBasis()
  const teams = useMemo(() => (teamIds.length ? dataset.teams.filter((t) => teamIds.includes(t.id)) : dataset.teams), [dataset, teamIds])

  const m = useMemo(() => {
    const opts = { mode, now, cfg }
    const time = flowTime(items, range, opts)
    const chartTime = flowTime(items, chartRange, opts)
    const load = flowLoad(items, chartRange, opts)
    return {
      period: {
        velocity: flowVelocity(items, range, cfg),
        time,
        efficiency: flowEfficiency(items, range, opts),
        distribution: flowDistribution(items, sprints, range, opts),
        size: sizeMix(items, range, cfg),
        teams: teamFlow(items, teams, range, opts, basis),
      },
      chart: {
        velocity: flowVelocity(items, chartRange, cfg),
        time: chartTime,
        load,
        efficiency: flowEfficiency(items, chartRange, opts),
        defect: flowInOut(items, "Defect", chartRange, opts),
        debt: flowInOut(items, "Debt", chartRange, opts),
        byWeek: flowTimeByWeek(items, chartRange, opts, basis),
        weekly: weeklyLoad(items, chartRange, opts, basis),
      },
      waiting: waitingNow(items, opts),
      coverage: historyCoverage(items, now, cfg),
      predictability: flowPredictability(dataset.programIncrements),
    }
  }, [items, cfg, sprints, teams, range, chartRange, now, mode, basis, dataset])

  const windowLabel = `since ${format(chartRange.start, "d MMM")}`
  const members = teams.reduce((n, t) => n + t.memberIds.length, 0)
  const { load } = m.chart

  return (
    <>
      <PageHeader
        title="Flow"
        description="How work flows through the system: what kind of work it is, where it waits, how long it takes and how much is in progress. Counts items, not points."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HistoryMeter coverage={m.coverage} />
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={basis}
              onValueChange={(v) => v && setBasis(v as FlowTimeBasis)}
              aria-label="Flow time starts"
            >
              <ToggleGroupItem value="created" className="px-3">
                From created
              </ToggleGroupItem>
              <ToggleGroupItem value="started" className="px-3">
                From work started
              </ToggleGroupItem>
            </ToggleGroup>
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
          </div>
        }
      />
      <Section title="Work mix" description="What kind of work is flowing: features, defects, risk and debt, and whether defects and debt are piling up.">
        <div className="grid gap-4 lg:grid-cols-2">
          <DistributionNow wip={m.period.distribution.wip} finished={m.period.distribution.finished} periodPhrase={periodPhrase} />
          <DistributionChart perSprint={m.period.distribution.perSprint} />
        </div>
        <DefectDebtInOut defect={m.chart.defect} debt={m.chart.debt} windowLabel={windowLabel} />
      </Section>

      <Section title="Wait states" description="How much of the time work is actively worked, which statuses it waits in, and what is waiting right now.">
        {/* Side by side only where both have room; "Where the time goes" needs ~400px for its labels. */}
        <div className="grid gap-4 xl:grid-cols-2">
          <EfficiencyChart efficiency={m.chart.efficiency} mode={mode} windowLabel={windowLabel} />
          <TimeByStatusBar byStatus={m.chart.efficiency.byStatus} mode={mode} windowLabel={windowLabel} />
        </div>
        <WaitingNow queues={m.waiting} mode={mode} />
      </Section>

      <Section title="Speed and load" description="How long work takes, and how much is in progress at once.">
        <FlowPrimaryTiles
          flowTime={flowTimePercentiles(m.period.time, basis)}
          finished={m.period.time.points.length}
          basis={basis}
          wipNow={load.wipNow}
          waitingNow={load.aging.filter((a) => a.state === "waiting").length}
          avgAgeDays={load.avgAgeDays}
          wipPerMember={members ? load.wipNow / members : null}
          mode={mode}
          periodPhrase={periodPhrase}
        />
        <SpeedVsThroughput
          flowTime={m.chart.byWeek}
          throughput={m.chart.velocity.perWeek}
          basis={basis}
          mode={mode}
          windowLabel={windowLabel}
          finished={m.chart.time.points.length}
        />
        <AgingWipChart aging={load.aging} cycle={m.chart.time.cycle} finished={m.chart.time.points.length} mode={mode} windowLabel={windowLabel} />
        <WipChart daily={load.daily} windowLabel={windowLabel} />
      </Section>

      <Section title="Supporting" description="Velocity and predictability, and every flow metric per team.">
        <FlowKpiRow velocity={m.period.velocity} size={m.period.size} predictability={m.predictability} />
        <TeamFlowTable rows={m.period.teams} basis={basis} mode={mode} periodPhrase={periodPhrase} />
      </Section>

      <MoreDetail>
        <FlowTimeScatter
          points={m.chart.time.points}
          percentiles={flowTimePercentiles(m.chart.time, basis)}
          basis={basis}
          mode={mode}
          windowLabel={windowLabel}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <WipExperimentChart weeks={m.chart.weekly} mode={mode} windowLabel={windowLabel} />
          <SizeMixChart mix={m.period.size} periodPhrase={periodPhrase} />
        </div>
        <PredictabilityChart rows={m.predictability} />
      </MoreDetail>
      <MeasurementNotes basis={basis} />
    </>
  )
}
