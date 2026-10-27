import { Badge } from "@/components/ui/badge"
import { useStatusInfo } from "@/hooks/useStatusInfo"
import { cn } from "@/lib/utils"
import { StatusDot } from "./StatusDot"

/** Outline badge with a leading dot in the status colour. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const info = useStatusInfo()(status)
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal whitespace-nowrap", className)}>
      <StatusDot colorVar={info.colorVar} />
      {status}
    </Badge>
  )
}
