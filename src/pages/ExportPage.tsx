import { format } from "date-fns"
import { CalendarDays, Copy, Download, Timer, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { MarkdownView } from "@/components/export/MarkdownView"
import { FilterPopover, type FilterOption } from "@/components/filters/FilterPopover"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/hooks/useData"
import { PERIODS, type Period } from "@/lib/jira/period"
import { buildReport, REPORT_SECTIONS, reportSprints, type ReportSection } from "@/lib/jira/report"

export default function ExportPage() {
  const { dataset, filters, period: headerPeriod } = useData()
  // Start from whatever the header is showing; changes here don't touch the dashboard.
  const [teamIds, setTeamIds] = useState(filters.teamIds)
  const [sprintIds, setSprintIds] = useState(filters.sprintIds)
  const [period, setPeriod] = useState<Period>(headerPeriod)
  const [sections, setSections] = useState<ReportSection[]>(REPORT_SECTIONS.map((s) => s.value))

  const teamOptions: FilterOption[] = dataset.teams.map((t) => ({ value: t.id, label: t.name }))
  const sprintOptions: FilterOption[] = reportSprints(dataset, teamIds, []).map((s) => ({
    value: String(s.id),
    label: s.name,
    group: (s.teamId && dataset.teamById.get(s.teamId)?.name) || "Other",
  }))

  const onTeams = (next: string[]) => {
    setTeamIds(next)
    // Drop picked sprints that no longer belong to a selected team.
    const allowed = new Set(reportSprints(dataset, next, []).map((s) => s.id))
    setSprintIds((ids) => ids.filter((id) => allowed.has(id)))
  }

  const toggleSection = (value: ReportSection, on: boolean) =>
    setSections((prev) => REPORT_SECTIONS.map((s) => s.value).filter((v) => (v === value ? on : prev.includes(v))))

  const markdown = useMemo(
    () => buildReport(dataset, { teamIds, sprintIds, period, sections }),
    [dataset, teamIds, sprintIds, period, sections],
  )

  const fileName = `sprint-report-${format(dataset.meta.generatedAt, "yyyy-MM-dd")}.md`

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }))
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${fileName}`)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      toast.success("Report copied to clipboard")
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  return (
    <>
      <PageHeader
        title="Export"
        description="Download a Markdown report of the dashboard for the teams, sprints and period you choose."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copy} disabled={!sections.length}>
              <Copy />
              Copy Markdown
            </Button>
            <Button size="sm" onClick={download} disabled={!sections.length}>
              <Download />
              Download .md
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Report options</CardTitle>
            <CardDescription>Empty selections mean all.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Scope</p>
              <div className="flex flex-wrap gap-2">
                <FilterPopover
                  title="Teams"
                  icon={Users}
                  options={teamOptions}
                  selected={teamIds}
                  onChange={onTeams}
                  align="start"
                />
                <FilterPopover
                  title="Sprints"
                  icon={Timer}
                  options={sprintOptions}
                  selected={sprintIds.map(String)}
                  onChange={(v) => setSprintIds(v.map(Number))}
                  align="start"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Time period</p>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger size="sm" className="h-8 w-full gap-1.5" aria-label="Report time period">
                  <CalendarDays className="size-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sections</p>
              {REPORT_SECTIONS.map((s) => (
                <div key={s.value} className="flex items-start gap-3">
                  <Checkbox
                    id={`section-${s.value}`}
                    checked={sections.includes(s.value)}
                    onCheckedChange={(on) => toggleSection(s.value, on === true)}
                    className="mt-0.5"
                  />
                  <div className="grid gap-1">
                    <Label htmlFor={`section-${s.value}`}>{s.label}</Label>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription className="font-mono">{fileName}</CardDescription>
          </CardHeader>
          <CardContent>
            {sections.length ? (
              <Tabs defaultValue="rendered">
                <TabsList>
                  <TabsTrigger value="rendered">Preview</TabsTrigger>
                  <TabsTrigger value="source">Markdown</TabsTrigger>
                </TabsList>
                <TabsContent value="rendered">
                  <ScrollArea className="h-[calc(100svh-18rem)] min-h-96 rounded-lg border">
                    <div className="p-6">
                      <MarkdownView markdown={markdown} />
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="source">
                  <ScrollArea className="h-[calc(100svh-18rem)] min-h-96 rounded-lg border bg-muted/40">
                    <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre">{markdown}</pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-sm text-muted-foreground">Pick at least one section to include.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
