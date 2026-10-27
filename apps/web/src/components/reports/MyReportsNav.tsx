import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from "@/components/ui/sidebar"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useReportMode } from "@/hooks/useReportMode"
import { useReports } from "@/hooks/useReports"
import { useSharedReports } from "@/hooks/useSharedReports"
import { DATA_MODE } from "@/lib/data/data-mode"
import type { ReportConfig } from "@jira-dashboard/core/report-config"
import type { StoredReport } from "@/lib/reports/report-store"
import { removeReport } from "@/lib/reports/store"
import { ImportLocalReports } from "./ImportLocalReports"
import { openReport } from "./open-report"
import { ReportMenuItem } from "./ReportMenuItem"
import { shareableLink } from "./report-links"
import { ShareDialog } from "./ShareDialog"

type Report = StoredReport<ReportConfig>

/**
 * Saved reports in the sidebar. Static build: "My Reports" in this browser.
 * With the server: "Created by me" and "Shared with me" (unread marked).
 */
export function MyReportsNav() {
  const reports = useReports()
  const shared = useSharedReports()
  const current = useReportMode()?.id
  const isAuthor = useCurrentUser()?.roles.includes("author") ?? false
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [deleting, setDeleting] = useState<Report | null>(null)
  const [sharing, setSharing] = useState<Report | null>(null)
  const server = DATA_MODE === "api"

  const copy = async (report: Report) => {
    try {
      await navigator.clipboard.writeText(shareableLink(report))
      toast.success("Report link copied", server ? { description: "People need access to open it: use Share… to add them." } : undefined)
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
    } catch (err) {
      toast.error("Couldn't delete the report", { description: (err as Error).message })
    }
  }

  const item = (report: Report) => (
    <ReportMenuItem
      key={report.id}
      report={report}
      active={report.id === current}
      onOpen={() => openReport(navigate, report.id, report.config.landingPage, pathname)}
      onCopyLink={() => copy(report)}
      onShare={server && report.canEdit ? () => setSharing(report) : undefined}
      onDelete={report.canEdit === false ? undefined : () => setDeleting(report)}
    />
  )
  const unread = shared?.filter((r) => r.unread).length ?? 0

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>{server ? "Created by me" : "My Reports"}</SidebarGroupLabel>
        <SidebarMenu>
          {reports?.length === 0 && (
            <li className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {server && !isAuthor ? "Reports shared with you appear below." : "Save a view as a report to see it here."}
            </li>
          )}
          {reports?.map(item)}
          {server && isAuthor && <ImportLocalReports />}
        </SidebarMenu>
      </SidebarGroup>

      {server && (
        <SidebarGroup>
          <SidebarGroupLabel className="gap-2">
            Shared with me
            {unread > 0 && (
              <Badge className="h-4 min-w-4 rounded-full px-1 text-[10px] tabular-nums" aria-label={`${unread} unread`}>
                {unread}
              </Badge>
            )}
          </SidebarGroupLabel>
          <SidebarMenu>
            {shared?.length === 0 && (
              <li className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Nothing shared with you yet.</li>
            )}
            {shared?.map(item)}
          </SidebarMenu>
        </SidebarGroup>
      )}

      <ShareDialog report={sharing} onOpenChange={(open) => !open && setSharing(null)} />
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.config.title}”?</DialogTitle>
            <DialogDescription>
              {server
                ? "It's deleted from the server, for everyone it's shared with."
                : "It's removed from this browser. Links you've already shared keep working, because a link carries the report itself."}
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
    </>
  )
}
