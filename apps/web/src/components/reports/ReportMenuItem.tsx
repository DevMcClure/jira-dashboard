import { FileText, Link2, MoreHorizontal, Share2, Snowflake, Trash2, Zap } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import type { ReportConfig } from "@jira-dashboard/core/report-config"
import type { StoredReport } from "@/lib/reports/report-store"

type Props = {
  report: StoredReport<ReportConfig>
  active: boolean
  onOpen: () => void
  onCopyLink: () => void
  /** Owners only (api mode). */
  onShare?: () => void
  /** Owners only. */
  onDelete?: () => void
}

/** One report in My Reports: open it, or use its menu. Unread shared reports carry a dot. */
export function ReportMenuItem({ report, active, onOpen, onCopyLink, onShare, onDelete }: Props) {
  const { isMobile } = useSidebar()
  const { config } = report
  const frozen = config.kind === "frozen"
  const subtitle = report.owner && !report.canEdit ? `From ${report.owner.displayName}` : null
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} tooltip={subtitle ? `${config.title} · ${subtitle}` : config.title} onClick={onOpen} className="h-auto py-1.5">
        {frozen ? <Snowflake /> : <FileText />}
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className={report.unread ? "truncate font-semibold" : "truncate"}>{config.title}</span>
          {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
        </span>
        {report.unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label={`Actions for ${config.title}`}>
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="start" className="w-48">
          <DropdownMenuItem onSelect={onOpen}>
            {frozen ? <Snowflake /> : <Zap />}
            Open
          </DropdownMenuItem>
          {onShare && (
            <DropdownMenuItem onSelect={onShare}>
              <Share2 />
              Share…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onCopyLink}>
            <Link2 />
            Copy link
          </DropdownMenuItem>
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
