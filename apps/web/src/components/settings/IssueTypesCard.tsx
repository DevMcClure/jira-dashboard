import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { typeRows, withCountsAsItem, withTypeMapping } from "@/lib/settings/flow-settings-editor"
import { FLOW_TYPES, type FlowConfig, type FlowType } from "@jira-dashboard/core/flowConfig"

const BY_LABELS = "__labels__"

type Props = { config: FlowConfig; types: string[]; disabled: boolean; onChange: (next: FlowConfig) => void }

/** Jira issue type → flow type, and which types aren't flow items at all. */
export function IssueTypesCard({ config, types, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue types</CardTitle>
        <CardDescription>
          The flow type each Jira type counts as (for flow distribution). “Decided by labels” uses the label rules below, otherwise Other. Types that
          don't count as flow items, such as containers and parts of items, are left out of every flow number.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issue type</TableHead>
              <TableHead className="w-56">Flow type</TableHead>
              <TableHead className="w-40">Counts as a flow item</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {typeRows(config, types).map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <Select
                    value={row.flowType ?? BY_LABELS}
                    onValueChange={(v) => onChange(withTypeMapping(config, row.name, v === BY_LABELS ? null : (v as FlowType)))}
                    disabled={disabled}
                  >
                    <SelectTrigger size="sm" className="w-full" aria-label={`${row.name} flow type`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      <SelectItem value={BY_LABELS}>Decided by labels</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={row.countsAsItem}
                    onCheckedChange={(on) => onChange(withCountsAsItem(config, row.name, on === true))}
                    disabled={disabled}
                    aria-label={`${row.name} counts as a flow item`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
