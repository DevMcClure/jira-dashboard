import { format } from "date-fns"
import { useMemo, type ReactNode } from "react"
import { AgingWipChart } from "@/components/flow/AgingWipChart"
import { DistributionChart } from "@/components/flow/DistributionChart"
import { DistributionNow } from "@/components/flow/DistributionNow"
import { EfficiencyChart } from "@/components/flow/EfficiencyChart"
import { FlowKpiRow } from "@/components/flow/FlowKpiRow"
import { FlowPrimaryTiles } from "@/components/flow/FlowPrimaryTiles"
import { FlowTimeScatter } from "@/components/flow/FlowTimeScatter"
import { HistoryMeter } from "@/components/flow/HistoryMeter"
import { MeasurementNotes } from "@/components/flow/MeasurementNotes"
import { PredictabilityChart } from "@/components/flow/PredictabilityChart"
import { SizeMixChart } from "@/components/flow/SizeMixChart"
import { SpeedVsThroughput } from "@/components/flow/SpeedVsThroughput"
import { TeamFlowTable } from "@/components/flow/TeamFlowTable"
import { TimeByStatusBar } from "@/components/flow/TimeByStatusBar"
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
  flowLoad,
  flowPredictability,
  flowTime,
  flowTimeByWeek,
  flowTimePercentiles,
  flowVelocity,
  historyCoverage,
  sizeMix,
  teamFlow,
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
 * The six SAFe flow metrics, in items and time rather than points. Flow Time
 * and Flow Load lead as the primary targets (decision 0024). KPIs use the
 * header period; charts use it too but cover at least the last 8 weeks.
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
        byWeek: flowTimeByWeek(items, chartRange, opts, basis),
        weekly: weeklyLoad(items, chartRange, opts, basis),
      },
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
        description="How work flows through the system: how long it takes, how much is in progress, and where the time goes. Counts items, not points."
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
      <MeasurementNotes basis={basis} />

      <Section title="Primary targets" description="Start with flow time and flow load: how long work takes, and how much is in progress at once.">
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
        <FlowTimeScatter
          points={m.chart.time.points}
          percentiles={flowTimePercentiles(m.chart.time, basis)}
          basis={basis}
          mode={mode}
          windowLabel={windowLabel}
        />
      </Section>

      <Section title="Load" description="There's no universal right amount of work in progress; find it by experiment, watching throughput and flow time.">
        <div className="grid gap-4 lg:grid-cols-2">
          <WipChart daily={load.daily} windowLabel={windowLabel} />
          <WipExperimentChart weeks={m.chart.weekly} mode={mode} windowLabel={windowLabel} />
        </div>
        <TeamFlowTable rows={m.period.teams} basis={basis} mode={mode} periodPhrase={periodPhrase} />
      </Section>

      <Section title="Supporting metrics" description="Velocity, efficiency, distribution and predictability explain why flow time and load move.">
        <FlowKpiRow
          velocity={m.period.velocity}
          size={m.period.size}
          efficiency={m.period.efficiency}
          distribution={m.period.distribution}
          predictability={m.predictability}
          periodPhrase={periodPhrase}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <SizeMixChart mix={m.period.size} periodPhrase={periodPhrase} />
          <EfficiencyChart efficiency={m.chart.efficiency} mode={mode} windowLabel={windowLabel} />
        </div>
        <TimeByStatusBar byStatus={m.chart.efficiency.byStatus} mode={mode} windowLabel={windowLabel} />
        <div className="grid gap-4 lg:grid-cols-2">
          <DistributionNow wip={m.period.distribution.wip} finished={m.period.distribution.finished} periodPhrase={periodPhrase} />
          <DistributionChart perSprint={m.period.distribution.perSprint} />
        </div>
        <PredictabilityChart rows={m.predictability} />
      </Section>
    </>
  )
}
