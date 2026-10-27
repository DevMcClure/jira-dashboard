import type { ReactNode } from "react"
import { EmptyState } from "@/components/common/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = { title: string; description: string; empty?: string | false; className?: string; children: ReactNode }

/** Card frame for the History page's charts, with an empty state when no stored day has the numbers. */
export function HistoryChartCard({ title, description, empty, className, children }: Props) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{empty ? <EmptyState className="h-56">{empty}</EmptyState> : children}</CardContent>
    </Card>
  )
}
