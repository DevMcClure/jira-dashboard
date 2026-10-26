import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { TIME_MODE_LABEL, type TimeMode } from "@/lib/jira/working-time"

/** States which clock a chart's durations use. */
export function ClockBadge({ mode }: { mode: TimeMode | "count" }) {
  return (
    <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
      <Clock className="size-3" />
      {mode === "count" ? "Item counts" : TIME_MODE_LABEL[mode]}
    </Badge>
  )
}
