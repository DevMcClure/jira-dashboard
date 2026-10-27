import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { statusRows, withStatusState } from "@/lib/settings/flow-settings-editor"
import { FLOW_STATES, type FlowConfig, type FlowState } from "@jira-dashboard/core/flowConfig"
import type { StatusInfo } from "@jira-dashboard/core/types"
import { CATEGORY_LABEL, STATE_LABEL } from "./flow-labels"

const FROM_CATEGORY = "__category__"

type Props = { config: FlowConfig; statuses: StatusInfo[]; disabled: boolean; onChange: (next: FlowConfig) => void }

/** Which statuses are active work, waiting, not started or done. */
export function StatusStatesCard({ config, statuses, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statuses</CardTitle>
        <CardDescription>
          Active and waiting statuses make up work in progress; flow efficiency is active time ÷ (active + waiting). A status you leave on “From Jira
          category” follows its Jira category.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Jira category</TableHead>
              <TableHead className="w-56">Counts as</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statusRows(config, statuses).map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{CATEGORY_LABEL[row.category]}</TableCell>
                <TableCell>
                  <Select
                    value={row.state ?? FROM_CATEGORY}
                    onValueChange={(v) => onChange(withStatusState(config, row.name, v === FROM_CATEGORY ? null : (v as FlowState)))}
                    disabled={disabled}
                  >
                    <SelectTrigger size="sm" className="w-full" aria-label={`${row.name} counts as`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATE_LABEL[s]}
                        </SelectItem>
                      ))}
                      <SelectItem value={FROM_CATEGORY}>From Jira category ({STATE_LABEL[row.fromCategory]})</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
