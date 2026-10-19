import { Minus, TrendingDown, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Sparkline } from "./Sparkline"

export type Delta = {
  text: string
  direction: "up" | "down" | "flat"
  /** Whether this movement is good news, bad news, or neither. */
  tone: "good" | "bad" | "neutral"
}

type Props = {
  label: string
  value: ReactNode
  unit?: string
  delta: Delta
  trend: number[]
}

const TONE_CLASS: Record<Delta["tone"], string> = {
  good: "text-status-done",
  bad: "text-status-blocked",
  neutral: "text-muted-foreground",
}

/** Reference-style KPI card: uppercase label, big number, delta line, sparkline. */
export function StatCard({ label, value, unit, delta, trend }: Props) {
  const Icon = delta.direction === "up" ? TrendingUp : delta.direction === "down" ? TrendingDown : Minus
  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-2 px-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold tabular-nums">
            {value}
            {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
          </p>
          <Sparkline values={trend} className="mb-1 h-9 w-14 shrink-0 xl:w-20" />
        </div>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Icon className={cn("mt-px size-3.5 shrink-0", TONE_CLASS[delta.tone])} aria-hidden />
          <span>{delta.text}</span>
        </p>
      </CardContent>
    </Card>
  )
}
