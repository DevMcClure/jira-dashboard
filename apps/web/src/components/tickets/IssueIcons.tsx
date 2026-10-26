import {
  Bookmark,
  Bug,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Equal,
  FlaskConical,
  ListTree,
  SquareCheck,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const TYPE_ICON: Record<string, LucideIcon> = {
  Story: Bookmark,
  Bug: Bug,
  Task: SquareCheck,
  "Sub-task": ListTree,
  Epic: Zap,
  Spike: FlaskConical,
}

const PRIORITY_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  Highest: { icon: ChevronsUp, className: "text-status-blocked" },
  High: { icon: ChevronUp, className: "text-status-blocked" },
  Medium: { icon: Equal, className: "text-status-qa" },
  Low: { icon: ChevronDown, className: "text-status-progress" },
  Lowest: { icon: ChevronsDown, className: "text-status-progress" },
}

export function TypeIcon({ type, withTooltip = true, className }: { type: string; withTooltip?: boolean; className?: string }) {
  const Icon = TYPE_ICON[type] ?? SquareCheck
  const icon = <Icon className={cn("size-4 text-muted-foreground", className)} aria-label={type} />
  if (!withTooltip) return icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{icon}</span>
      </TooltipTrigger>
      <TooltipContent>{type}</TooltipContent>
    </Tooltip>
  )
}

export function PriorityIcon({
  priority,
  withTooltip = true,
  className,
}: {
  priority: string
  withTooltip?: boolean
  className?: string
}) {
  const { icon: Icon, className: tone } = PRIORITY_ICON[priority] ?? PRIORITY_ICON.Medium
  const icon = <Icon className={cn("size-4", tone, className)} aria-label={`${priority} priority`} />
  if (!withTooltip) return icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{icon}</span>
      </TooltipTrigger>
      <TooltipContent>{priority} priority</TooltipContent>
    </Tooltip>
  )
}
