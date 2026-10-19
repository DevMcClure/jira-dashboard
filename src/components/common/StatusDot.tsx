import { cn } from "@/lib/utils"

/** Small coloured dot; `colorVar` is a CSS custom property name like "--status-done". */
export function StatusDot({ colorVar, className }: { colorVar: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: `var(${colorVar})` }}
    />
  )
}
