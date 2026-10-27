import { TriangleAlert } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatDays } from "@/lib/format"
import { FLOW_TIME_BASIS_LABEL, sampleQuality, type FlowTimeBasis, type Percentiles } from "@jira-dashboard/core/flow"
import type { TimeMode } from "@jira-dashboard/core/working-time"
import { ClockBadge } from "./ClockBadge"

type Props = {
  flowTime: Percentiles
  finished: number
  basis: FlowTimeBasis
  wipNow: number
  /** Of those, how many sit in a waiting status (In Review, Blocked). */
  waitingNow: number
  avgAgeDays: number | null
  /** WIP divided by the people on the teams in view; null if no team lists members. */
  wipPerMember: number | null
  mode: TimeMode
  /** Completes "… finished in the last 7 days". */
  periodPhrase: string
}

const unitFor = (mode: TimeMode) => (mode === "working" ? "working days" : "days")

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}

/** The article's primary optimisation targets, side by side: how long work takes, and how much is in progress. */
export function FlowPrimaryTiles({ flowTime, finished, basis, wipNow, waitingNow, avgAgeDays, wipPerMember, mode, periodPhrase }: Props) {
  const quality = sampleQuality(finished)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-4 py-5">
        <CardContent className="space-y-4 px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Flow time · 85% within</p>
              <p className="text-4xl font-semibold tabular-nums">
                {formatDays(flowTime.p85)}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">{unitFor(mode)}</span>
              </p>
            </div>
            <ClockBadge mode={mode} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Figure label="Typical (50%)" value={formatDays(flowTime.p50)} unit="d" />
            <Figure label="95% within" value={formatDays(flowTime.p95)} unit="d" />
            <Figure label="Items finished" value={String(finished)} />
          </div>
          <p className="text-xs text-muted-foreground">
            {FLOW_TIME_BASIS_LABEL[basis]} to done, for items finished {periodPhrase}.
          </p>
          {quality.note && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              {quality.note}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="gap-4 py-5">
        <CardContent className="space-y-4 px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Flow load · in progress now</p>
              <p className="text-4xl font-semibold tabular-nums">
                {wipNow}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">items</span>
              </p>
            </div>
            <ClockBadge mode={mode} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Figure label="Average age" value={formatDays(avgAgeDays)} unit="d" />
            <Figure label="Per team member" value={wipPerMember === null ? "—" : wipPerMember.toFixed(1)} />
            <Figure label="Waiting now" value={String(waitingNow)} unit={wipNow ? `${Math.round((waitingNow / wipNow) * 100)}%` : undefined} />
          </div>
          <p className="text-xs text-muted-foreground">
            High WIP means more context switching. There's no universal right level: lower WIP limits gradually and watch
            throughput and flow time below.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
