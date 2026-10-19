import { useId } from "react"
import { Area, AreaChart, YAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoad } from "@/hooks/useFirstLoad"

/** Tiny decorative trend line (last N days). The card's number + delta carry the data. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = useId().replace(/:/g, "")
  const loading = useFirstLoad()
  const data = values.map((v, i) => ({ i, v }))
  if (loading) return <Skeleton className={className} />
  if (data.length < 2) return null
  return (
    <ChartContainer config={{}} className={cn("aspect-auto", className)} aria-hidden>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          dataKey="v"
          type="monotone"
          stroke="var(--chart-1)"
          strokeWidth={1.5}
          fill={`url(#spark-${id})`}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
