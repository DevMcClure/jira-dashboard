import { format } from "date-fns"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useData } from "@/hooks/useData"
import { originLabel } from "@/lib/data/origin-label"

export default function AboutPage() {
  const { dataset, source } = useData()
  const { meta } = dataset
  const rows: [string, string][] = [
    ["Loaded from", originLabel(source).long],
    ["Source", meta.source ?? "—"],
    ["Format version", meta.version ?? "—"],
    ["Generated at", format(meta.generatedAt, "d MMM yyyy, HH:mm")],
    ["Jira", meta.jiraBaseUrl ?? "—"],
    ["Teams", String(dataset.teams.length)],
    ["Sprints", String(dataset.sprints.length)],
    ["Tickets", String(dataset.issues.length)],
    ["Status transitions", String(dataset.transitions.length)],
  ]

  return (
    <>
      <PageHeader title="About" description="What Jira Dashboard is and where its data comes from." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jira Dashboard</CardTitle>
            <CardDescription>A proof-of-concept Jira sprint dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Jira Dashboard reads a JSON export produced by the Jira Trawler script and visualises ticket counts,
              remaining work, sprint progress and how tickets move through the workflow over time.
            </p>
            <p>
              Everything runs in your browser. There is no backend and nothing is sent anywhere. Uploaded files are
              only remembered in this browser's local storage.
            </p>
            <p>
              "Now" for every metric is the export's generation time, not today's date, so a snapshot always reads
              the way it did when it was taken.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Current data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
