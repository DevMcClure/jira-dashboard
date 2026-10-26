import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FLOW_TIME_BASIS_LABEL, type FlowTimeBasis } from "@jira-dashboard/core/flow"
import { DEFAULT_FLOW_CONFIG } from "@jira-dashboard/core/flowConfig"

type Props = { basis: FlowTimeBasis }

/** "How these are measured": start and end points, formulas, exclusions and clocks, so the numbers can be trusted and compared. */
export function MeasurementNotes({ basis }: Props) {
  const cfg = DEFAULT_FLOW_CONFIG
  const states = (state: string) =>
    Object.entries(cfg.statusStates)
      .filter(([, s]) => s === state)
      .map(([name]) => name)
      .join(", ")
  const hours = cfg.workingHours
  const rows: [string, string][] = [
    [
      "Flow time",
      `${FLOW_TIME_BASIS_LABEL[basis]}: ${
        basis === "created" ? "from when the item was created (entered the backlog)" : "from its first move into an active status"
      } to its last move into Done. Reported as the 50th / 85th / 95th percentile of items finished in the window, never the mean. Switch the start point in the header.`,
    ],
    ["Flow load", `Items in an active or waiting status (${states("active")}, ${states("waiting")}) at the end of each day. Age counts from work started.`],
    ["Flow velocity", "Items that first reached Done in the window, counted regardless of size or priority. See “Size of finished items” for the size mix."],
    ["Flow efficiency", "Flow Efficiency = (Active Time ÷ Total Flow Time) × 100, over items finished in the window. Time in Done between a finish and a reopen counts as waiting."],
    ["Flow distribution", "Share of items by flow type: Story / Epic → Feature, Bug → Defect; Task and Spike count as Debt or Risk only when labelled tech-debt or risk, otherwise Other."],
    ["Flow predictability", "Actual ÷ planned business value of committed PI objectives; uncommitted objectives add to actual only."],
    [
      "Statuses",
      `Active: ${states("active")}. Waiting: ${states("waiting")}. Not started: ${states("not-started")}. Unknown statuses follow their Jira category.`,
    ],
    ["Excluded", `${cfg.excludeTypes.join(" and ")} aren't flow items (they contain or belong to other items).`],
    [
      "Clocks",
      `Working hours: Mon–Fri ${String(hours.start).padStart(2, "0")}:00–${hours.end}:00 ${hours.timeZone.replace("_", " ")}, so a working day is ${hours.end - hours.start} hours. Calendar time counts nights and weekends.`,
    ],
  ]
  return (
    <Collapsible asChild>
      <Card className="gap-0">
        <CardHeader>
          <CardTitle>How these are measured</CardTitle>
          <CardDescription>Start and end points, formulas and exclusions. Flow metrics describe the system, not individuals.</CardDescription>
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
          <CardContent className="pt-4">
            <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-[10rem_1fr]">
              {rows.map(([term, text]) => (
                <div key={term} className="contents">
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-muted-foreground">{text}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
