import { format } from "date-fns"
import { Snowflake, Zap } from "lucide-react"
import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useData } from "@/hooks/useData"
import { periodLabel } from "@jira-dashboard/core/period"
import {
  configFromView,
  DEFAULT_REPORT_PAGES,
  PI_PAGES,
  REPORT_PAGES,
  type DashboardView,
  type ReportKind,
  type ReportPageId,
} from "@jira-dashboard/core/report-config"
import { saveReport } from "@/lib/reports/store"
import { openReport } from "./open-report"

const AUTHOR_KEY = "jira-dashboard:report-author"

const readAuthor = () => {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? ""
  } catch {
    return ""
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The view to save (the header's, or the Export page's options). */
  view: DashboardView
  defaultTitle?: string
}

/** Name the current view and choose its pages; saves it to My Reports. */
export function SaveReportDialog({ open, onOpenChange, view, defaultTitle = "" }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remounted on each open so fields start fresh. */}
        {open && <SaveReportForm view={view} defaultTitle={defaultTitle} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SaveReportForm({ view, defaultTitle, onDone }: { view: DashboardView; defaultTitle: string; onDone: () => void }) {
  const { dataset } = useData()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const available = REPORT_PAGES.filter((p) => dataset.programIncrements.length || !PI_PAGES.includes(p.id))
  const [title, setTitle] = useState(defaultTitle)
  const [note, setNote] = useState("")
  const [author, setAuthor] = useState(readAuthor)
  const [kind, setKind] = useState<ReportKind>("live")
  const [pages, setPages] = useState<ReportPageId[]>(() => DEFAULT_REPORT_PAGES.filter((id) => available.some((p) => p.id === id)))
  const [landing, setLanding] = useState<ReportPageId>(pages[0] ?? "overview")
  const [busy, setBusy] = useState(false)

  const togglePage = (id: ReportPageId, on: boolean) => {
    const next = available.map((p) => p.id).filter((p) => (p === id ? on : pages.includes(p)))
    setPages(next)
    if (!next.includes(landing) && next.length) setLanding(next[0])
  }

  const names = (ids: string[], lookup: (id: string) => string | undefined, all: string) =>
    ids.length ? ids.map((id) => lookup(id) ?? id).join(", ") : all
  const summary = [
    ["Scope", view.scope.kind === "pi" ? (dataset.piById.get(view.scope.piId)?.name ?? view.scope.piId) : "Current sprint"],
    ["Teams", names(view.filters.teamIds, (id) => dataset.teamById.get(id)?.name, "All teams")],
    ["Sprints", names(view.filters.sprintIds.map(String), (id) => dataset.sprintById.get(Number(id))?.name, "All in scope")],
    ["Assignees", view.filters.assigneeIds.length ? `${view.filters.assigneeIds.length} selected` : "Everyone"],
    [
      "Period",
      kind === "frozen" || view.period === "custom"
        ? `${format(view.range.start, "d MMM")} – ${format(view.range.end, "d MMM yyyy")} (pinned)`
        : periodLabel(view.period, view.range),
    ],
  ]

  const save = async () => {
    setBusy(true)
    try {
      const config = configFromView(view, { title, note, author, kind, pages, landingPage: landing })
      const saved = await saveReport({ config })
      try {
        localStorage.setItem(AUTHOR_KEY, author.trim())
      } catch {
        // Not remembered; fine.
      }
      toast.success(`Saved “${config.title}”`, {
        description: "It's in My Reports in the sidebar.",
        action: { label: "Open", onClick: () => openReport(navigate, saved.id, config.landingPage, pathname) },
      })
      onDone()
    } catch {
      toast.error("Couldn't save the report", { description: "Check the title and pages, or this browser's storage may be full." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Save as report</DialogTitle>
        <DialogDescription>
          Anyone who opens it sees the dashboard set up like this, with the filters locked.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="report-title">Title</Label>
          <Input id="report-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. WEB 26.4.4 status" autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-note">Note (optional)</Label>
          <Textarea id="report-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What should readers look at?" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-author">Your name (optional)</Label>
          <Input id="report-author" value={author} maxLength={80} onChange={(e) => setAuthor(e.target.value)} />
        </div>

        <div className="grid gap-1.5">
          <Label>Kind</Label>
          <ToggleGroup type="single" variant="outline" size="sm" value={kind} onValueChange={(v) => v && setKind(v as ReportKind)} className="w-full">
            <ToggleGroupItem value="live" className="flex-1 gap-1.5">
              <Zap /> Live
            </ToggleGroupItem>
            <ToggleGroupItem value="frozen" className="flex-1 gap-1.5">
              <Snowflake /> Frozen
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {kind === "live"
              ? "Live: the filters are re-applied to whatever data is loaded, and the period stays relative."
              : "Frozen: the period is pinned to these dates, and the report records which data it was made from."}
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Pages</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {available.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={pages.includes(p.id)} onCheckedChange={(on) => togglePage(p.id, on === true)} />
                {p.title}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Opens on</Label>
          <Select value={landing} onValueChange={(v) => setLanding(v as ReportPageId)} disabled={!pages.length}>
            <SelectTrigger size="sm" className="w-full" aria-label="Landing page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {available
                .filter((p) => pages.includes(p.id))
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
          {summary.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || !title.trim() || !pages.length}>
          Save report
        </Button>
      </DialogFooter>
    </>
  )
}
