import { FileText, Link2, MoreHorizontal, Snowflake, Trash2, Zap } from "lucide-react"
import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useReportMode } from "@/hooks/useReportMode"
import { useReports } from "@/hooks/useReports"
import { reportLink, type ReportConfig } from "@/lib/reports/report-config"
import type { StoredReport } from "@/lib/reports/report-store"
import { removeReport } from "@/lib/reports/store"
import { openReport } from "./open-report"

/** Sidebar group listing the reports saved in this browser, with Open / Copy link / Delete. */
export function MyReportsNav() {
  const reports = useReports()
  const current = useReportMode()?.id
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMobile } = useSidebar()
  const [deleting, setDeleting] = useState<StoredReport<ReportConfig> | null>(null)

  const copy = async (config: ReportConfig) => {
    try {
      await navigator.clipboard.writeText(reportLink(config, window.location.origin, import.meta.env.BASE_URL))
      toast.success("Report link copied")
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const { id, config } = deleting
    setDeleting(null)
    // Leave the report first, so its page doesn't report it as missing.
    if (id === current) navigate("/")
    try {
      await removeReport(id)
      toast.success(`Deleted “${config.title}”`)
    } catch {
      toast.error("Couldn't delete the report")
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>My Reports</SidebarGroupLabel>
      <SidebarMenu>
        {reports?.length === 0 && (
          <li className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Save a view as a report to see it here.
          </li>
        )}
        {reports?.map((report) => {
          const { id, config } = report
          return (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton
                isActive={id === current}
                tooltip={config.title}
                onClick={() => openReport(navigate, id, config.landingPage, pathname)}
              >
                {config.kind === "frozen" ? <Snowflake /> : <FileText />}
                <span>{config.title}</span>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover aria-label={`Actions for ${config.title}`}>
                    <MoreHorizontal />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="start" className="w-48">
                  <DropdownMenuItem onSelect={() => openReport(navigate, id, config.landingPage, pathname)}>
                    {config.kind === "frozen" ? <Snowflake /> : <Zap />}
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => copy(config)}>
                    <Link2 />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(report)}>
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.config.title}”?</DialogTitle>
            <DialogDescription>
              It's removed from this browser. Links you've already shared keep working, because a link carries the report itself.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarGroup>
  )
}
