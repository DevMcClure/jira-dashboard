import type { ReactNode } from "react"
import { EmptyState } from "@/components/common/EmptyState"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoad } from "@/hooks/useFirstLoad"
import type { TimeMode } from "@/lib/jira/working-time"
import { cn } from "@/lib/utils"
import { ClockBadge } from "./ClockBadge"

type Props = {
  title: string
  description: string
  /** Which clock the chart uses, or "count" for charts of item counts. */
  mode: TimeMode | "count"
  empty?: string | false
  className?: string
  heightClass?: string
  children: ReactNode
}

/** Card frame shared by the Flow page's charts: title, window, clock badge, skeleton and empty state. */
export function FlowChartCard({ title, description, mode, empty, className, heightClass = "h-64", children }: Props) {
  const loading = useFirstLoad()
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
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
    </Card>
  )
}
