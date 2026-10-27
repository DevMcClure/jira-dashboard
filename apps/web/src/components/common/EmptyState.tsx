import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Centred muted message, like the reference app's "No results." */
export function EmptyState({ children = "No results.", className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center text-center text-sm text-muted-foreground", className)}>
      {children}
    </div>
  )
}
