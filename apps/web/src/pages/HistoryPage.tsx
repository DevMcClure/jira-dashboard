import { useMemo, useState } from "react"
import { EmptyState } from "@/components/common/EmptyState"
import { HealthStrip } from "@/components/history/HealthStrip"
import { HistoryTable } from "@/components/history/HistoryTable"
import { MetricHistoryChart } from "@/components/history/MetricHistoryChart"
import { RemainingHistoryChart } from "@/components/history/RemainingHistoryChart"
import { StatusHistoryChart } from "@/components/history/StatusHistoryChart"
import { TakeSnapshotButton } from "@/components/history/TakeSnapshotButton"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useData } from "@/hooks/useData"
import { useSnapshots } from "@/hooks/useSnapshots"
import { historyRanges, historySeries } from "@/lib/data/history-series"

const TITLE = "History"
const DESCRIPTION = "Day-by-day snapshots of each team, taken every morning and kept even after the Trawler stops exporting old tickets."

/**
 * Trends read from the stored daily snapshots (not replayed from the current
 * export). api mode only; the static build shows why it's empty.
 */
export default function HistoryPage() {
  const { liveDataset, history } = useData()
  const isAdmin = useCurrentUser()?.roles.includes("admin") ?? false
  const ranges = useMemo(() => historyRanges(liveDataset), [liveDataset])
  const [teamId, setTeamId] = useState(liveDataset.teams[0]?.id ?? "")
  const [rangeId, setRangeId] = useState(ranges[0].id)
  const [reload, setReload] = useState(0)
  const range = ranges.find((r) => r.id === rangeId) ?? ranges[0]
  const state = useSnapshots(history, teamId, range.from, range.to, reload)
  const series = useMemo(() => (state.status === "ready" ? historySeries(state.snapshots, range.from, range.to) : null), [state, range])

  if (!history) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Card>
          <CardContent>
            <EmptyState className="h-40">Snapshot history needs the dashboard's server. This demo reads a file in your browser, so there's no history to show.</EmptyState>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger size="sm" className="h-8 w-40" aria-label="Team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {liveDataset.teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToggleGroup type="single" variant="outline" size="sm" value={range.id} onValueChange={(v) => v && setRangeId(v)} aria-label="Range">
              {ranges.map((r) => (
                <ToggleGroupItem key={r.id} value={r.id} className="px-3">
                  {r.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {isAdmin && <TakeSnapshotButton history={history} onDone={() => setReload((n) => n + 1)} />}
          </div>
        }
      />

      {state.status === "loading" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      )}
      {state.status === "error" && (
        <Card>
          <CardContent>
            <EmptyState className="h-32">Couldn't load the snapshots: {state.message}</EmptyState>
          </CardContent>
        </Card>
      )}
      {state.status === "ready" && series && state.snapshots.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState className="h-40">
              No snapshots for this team between {range.from} and {range.to} yet. They're taken every morning; admins can take one now, or fill in past days
              with <code className="font-mono">pnpm snapshot:backfill</code>.
            </EmptyState>
          </CardContent>
        </Card>
      )}
      {state.status === "ready" && series && state.snapshots.length > 0 && (
        <>
          <HealthStrip rows={series.rows} />
          <div className="grid gap-4 lg:grid-cols-2">
            <RemainingHistoryChart rows={series.rows} />
            <StatusHistoryChart rows={series.rows} statuses={series.statuses} />
            <MetricHistoryChart
              rows={series.rows}
              metric="wip"
              title="Work in progress"
              description="Items in an active or waiting status at the end of each day."
              unit="Items"
              empty="No work in progress recorded."
            />
            <MetricHistoryChart
              rows={series.rows}
              metric="cycleTimeP85"
              title="Cycle time (85th percentile)"
              description="Working days from start to done, for items finished in the 28 days up to each day."
              unit="Working days"
              empty="Nothing finished in the 28 days before these days."
            />
          </div>
          <HistoryTable rows={series.rows} />
        </>
      )}
    </>
  )
}
