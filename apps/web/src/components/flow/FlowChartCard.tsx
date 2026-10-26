import { Lightbulb, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { EmptyState } from "@/components/common/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoad } from "@/hooks/useFirstLoad"
import { sampleQuality } from "@jira-dashboard/core/flow"
import type { TimeMode } from "@jira-dashboard/core/working-time"
import { cn } from "@/lib/utils"
import { ClockBadge } from "./ClockBadge"

type Props = {
  title: string
  description: string
  /** Which clock the chart uses, or "count" for charts of item counts. */
  mode: TimeMode | "count"
  empty?: string | false
  /** A "what to look for" line under the chart. */
  hint?: string
  /** Finished items behind the chart's percentiles; shows n and a warning when it's thin. */
  sample?: number
  /** Extra controls in the header (e.g. a Count / Share toggle). */
  actions?: ReactNode
  className?: string
  heightClass?: string
  children: ReactNode
}

/** Card frame shared by the Flow page's charts: title, window, clock badge, sample size, hint, skeleton and empty state. */
export function FlowChartCard({ title, description, mode, empty, hint, sample, actions, className, heightClass = "h-64", children }: Props) {
  const loading = useFirstLoad()
  const quality = sample === undefined ? null : sampleQuality(sample)
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction className="flex flex-wrap items-center justify-end gap-1.5">
          {actions}
          {sample !== undefined && (
            <Badge variant="outline" className="font-normal text-muted-foreground tabular-nums">
              n = {sample}
            </Badge>
          )}
          <ClockBadge mode={mode} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className={cn(heightClass, "w-full")} />
        ) : empty ? (
          <EmptyState className={heightClass}>{empty}</EmptyState>
        ) : (
          children
        )}
      </CardContent>
      {(hint || quality?.note) && !empty && (
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          {quality?.note && quality.level !== "none" && (
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              {quality.note}
            </p>
          )}
          {hint && (
            <p className="flex items-start gap-1.5">
              <Lightbulb className="mt-px size-3.5 shrink-0" aria-hidden />
              {hint}
            </p>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
