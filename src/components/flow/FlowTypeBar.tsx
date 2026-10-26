import { FLOW_TYPES, type FlowType } from "@/lib/jira/flowConfig"
import { cn } from "@/lib/utils"
import { flowTypeVar } from "./flow-type-colors"

/** A 100% bar of flow types, in fixed order and colours, with 2px gaps between segments. */
export function FlowTypeBar({ counts, className, label }: { counts: Record<FlowType, number>; className?: string; label: string }) {
  const total = FLOW_TYPES.reduce((n, t) => n + counts[t], 0)
  if (!total) return <div className={cn("h-2.5 w-full rounded bg-muted", className)} role="img" aria-label={`${label}: none`} />
  const summary = FLOW_TYPES.filter((t) => counts[t])
    .map((t) => `${t} ${Math.round((counts[t] / total) * 100)}%`)
    .join(", ")
  return (
    <div className={cn("flex h-2.5 w-full gap-0.5 overflow-hidden rounded", className)} role="img" aria-label={`${label}: ${summary}`} title={summary}>
      {FLOW_TYPES.filter((t) => counts[t]).map((t) => (
        <div key={t} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(counts[t] / total) * 100}%`, backgroundColor: `var(${flowTypeVar(t)})` }} />
      ))}
    </div>
  )
}
