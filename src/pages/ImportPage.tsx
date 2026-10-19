import { format } from "date-fns"
import { ChevronDown, CircleCheck, Download, RotateCcw, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { DropZone } from "@/components/import/DropZone"
import { EXAMPLE_EXPORT, REQUIRED_FIELDS } from "@/components/import/example-export"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useData } from "@/hooks/useData"

type Outcome = { kind: "ok"; fileName: string } | { kind: "error"; fileName: string; problems: string[] }

export default function ImportPage() {
  const { dataset, source, rawJson, loadFromFile, resetToSample } = useData()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const onFile = async (file: File) => {
    setBusy(true)
    const result = await loadFromFile(file)
    setBusy(false)
    setOutcome(result.ok ? { kind: "ok", fileName: file.name } : { kind: "error", fileName: file.name, problems: result.problems })
  }

  const download = () => {
    const blob = new Blob([rawJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = source.kind === "upload" ? source.fileName : "jira-export.sample.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const summary: [string, string][] = [
    ["Loaded from", source.kind === "sample" ? "Bundled sample data" : source.fileName],
    ["Source", dataset.meta.source ?? "—"],
    ["Generated at", format(dataset.meta.generatedAt, "d MMM yyyy, HH:mm")],
    ["Sprints", String(dataset.sprints.length)],
    ["Teams", String(dataset.teams.length)],
    ["Tickets", String(dataset.issues.length)],
    ["Transitions", String(dataset.transitions.length)],
  ]

  return (
    <>
      <PageHeader
        title="Import"
        description="Load a Jira Trawler JSON export to replace the sample data."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetToSample} disabled={source.kind === "sample"}>
              <RotateCcw />
              Reset to sample data
            </Button>
            <Button variant="outline" size="sm" onClick={download}>
              <Download />
              Download current data
            </Button>
          </div>
        }
      />

      <DropZone onFile={onFile} busy={busy} />

      {outcome?.kind === "error" && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-destructive" />
              Couldn't load {outcome.fileName}
            </CardTitle>
            <CardDescription>
              The previous data is still loaded. Fix {outcome.problems.length === 1 ? "this problem" : `these ${outcome.problems.length} problems`} and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <ul className="space-y-1.5 font-mono text-xs">
                {outcome.problems.map((p, i) => {
                  const [path, ...rest] = p.split(": ")
                  return (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 text-destructive">{rest.length ? path : "•"}</span>
                      <span className="text-muted-foreground">{rest.length ? rest.join(": ") : p}</span>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {outcome?.kind === "ok" && <CircleCheck className="size-4 text-status-done" />}
            {outcome?.kind === "ok" ? `Loaded ${outcome.fileName}` : "Current data"}
          </CardTitle>
          <CardDescription>What the dashboard is showing right now.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
            {summary.map(([label, value]) => (
              <div key={label} className="min-w-0 space-y-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
                <dd className="truncate text-sm font-medium tabular-nums" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Collapsible asChild>
        <Card>
          <CardHeader>
            <CardTitle>Expected format</CardTitle>
            <CardDescription>A trimmed example of a Jira Trawler export.</CardDescription>
            <CardAction>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="group">
                  <span className="group-data-[state=open]:hidden">Show</span>
                  <span className="hidden group-data-[state=open]:inline">Hide</span>
                  <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
            </CardAction>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {REQUIRED_FIELDS.map((f) => (
                  <li key={f}>{f}</li>
                ))}
                <li>Unknown fields are ignored; unknown statuses are coloured by their category.</li>
              </ul>
              <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                {EXAMPLE_EXPORT}
              </pre>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </>
  )
}
