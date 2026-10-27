import { format } from "date-fns"
import { BookmarkPlus, Compass, Link2, LogOut, Share2, Snowflake, TriangleAlert, Zap } from "lucide-react"
import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { REPORT_RETURN_KEY } from "@/context/report-mode"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useData } from "@/hooks/useData"
import { DATA_MODE } from "@/lib/data/data-mode"
import { useReportMode } from "@/hooks/useReportMode"
import { pageForPath, pagePath } from "@jira-dashboard/core/report-config"
import { saveReport } from "@/lib/reports/store"
import { shareableLink } from "./report-links"
import { ShareDialog } from "./ShareDialog"

const AS_OF = "d MMM yyyy, HH:mm"

/** Names the open report and offers Copy link, Save, Explore from here and Exit. Report mode only. */
export function ReportBanner() {
  const report = useReportMode()
  const { dataset } = useData()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isAuthor = useCurrentUser()?.roles.includes("author") ?? false
  const [sharing, setSharing] = useState(false)
  if (!report) return null
  const { config, id, basePath, stored } = report
  const server = DATA_MODE === "api"
  // With the server only authors save reports; in the static build anyone can, in their browser.
  const canSave = !server || isAuthor
  const byline = stored?.owner?.displayName ?? config.author
  const frozen = config.kind === "frozen"
  const generatedAt = dataset.meta.generatedAt
  const mismatch = generatedAt.toISOString() !== config.dataStamp
  // The current page, relative to the report ("/details"), for Explore and Save.
  const inner = pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : "/"

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink({ id, config }))
      toast.success("Report link copied", {
        description:
          server && id
            ? "People need access to open it: the owner can share it with them."
            : "Anyone with the link sees this view. It works in any browser.",
      })
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  const saveHere = async () => {
    try {
      const saved = await saveReport({ config })
      toast.success(`Saved “${config.title}” to My Reports`)
      navigate(`/reports/${saved.id}${inner === "/" ? "" : inner}`, { replace: true })
    } catch (err) {
      toast.error("Couldn't save the report", { description: server ? (err as Error).message : "This browser's storage is blocked or full." })
    }
  }

  const explore = () => {
    report.applyToDashboard()
    toast.success("Exploring with the report's filters", { description: "Change anything; the report itself stays as saved." })
    navigate(pageForPath(inner) ? inner : pagePath(config.landingPage))
  }

  const exit = () => {
    let back = "/"
    try {
      back = sessionStorage.getItem(REPORT_RETURN_KEY) ?? "/"
      sessionStorage.removeItem(REPORT_RETURN_KEY)
    } catch {
      // No session storage: go to the dashboard.
    }
    navigate(back)
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3" role="region" aria-label="Report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Report</span>
            <span className="truncate font-semibold">{config.title}</span>
            <Badge variant="outline" className="gap-1 font-normal">
              {frozen ? <Snowflake className="size-3" /> : <Zap className="size-3" />}
              {frozen ? "Frozen" : "Live"}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {byline ? `By ${byline} · ` : ""}
            {frozen && config.from && config.to
              ? `Pinned to ${format(new Date(config.from), "d MMM")} – ${format(new Date(config.to), "d MMM yyyy")} · `
              : ""}
            Data as of {format(generatedAt, AS_OF)} · Filters are locked
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Link2 />
            Copy link
          </Button>
          {server && stored?.canEdit && (
            <Button variant="outline" size="sm" onClick={() => setSharing(true)}>
              <Share2 />
              Share…
            </Button>
          )}
          {id === null && canSave && (
            <Button variant="outline" size="sm" onClick={saveHere}>
              <BookmarkPlus />
              Save to My Reports
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={explore}>
            <Compass />
            Explore from here
          </Button>
          <Button size="sm" onClick={exit}>
            <LogOut />
            Exit report
          </Button>
        </div>
      </div>
      {config.note && <p className="text-sm whitespace-pre-wrap">{config.note}</p>}
      <ShareDialog report={sharing ? stored : null} onOpenChange={setSharing} />
      {mismatch && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-status-qa" />
          Saved from data generated {format(new Date(config.dataStamp), AS_OF)}; the loaded data was generated{" "}
          {format(generatedAt, AS_OF)}, so numbers may differ.
        </p>
      )}
    </div>
  )
}
