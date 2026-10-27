import { Plus, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { withLabel } from "@/lib/settings/flow-settings-editor"
import { FLOW_TYPES, type FlowConfig, type FlowType } from "@jira-dashboard/core/flowConfig"

type Props = { config: FlowConfig; suggestions: string[]; disabled: boolean; onChange: (next: FlowConfig) => void }

/** Labels that make an otherwise unmapped type count as Debt, Risk, etc. */
export function LabelRulesCard({ config, suggestions, disabled, onChange }: Props) {
  const [label, setLabel] = useState("")
  const [type, setType] = useState<FlowType>("Debt")
  const rules = Object.entries(config.labelTypes).sort(([a], [b]) => a.localeCompare(b))
  const add = () => {
    onChange(withLabel(config, label, type))
    setLabel("")
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Labels</CardTitle>
        <CardDescription>For issue types set to “Decided by labels”: a label here sets the flow type (matched ignoring case). The first matching label wins.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No label rules: unmapped types count as Other.</p>
        ) : (
          <ul className="space-y-2">
            {rules.map(([name, flowType]) => (
              <li key={name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{name}</span>
                <Select value={flowType} onValueChange={(v) => onChange(withLabel(config, name, v as FlowType))} disabled={disabled}>
                  <SelectTrigger size="sm" className="w-36" aria-label={`Flow type for label ${name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLOW_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange(withLabel(config, name, null))} disabled={disabled} aria-label={`Remove label ${name}`}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!disabled && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. security" list="flow-label-suggestions" className="h-8 flex-1" aria-label="New label" />
            <datalist id="flow-label-suggestions">
              {suggestions.filter((s) => !(s.toLowerCase() in config.labelTypes)).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Select value={type} onValueChange={(v) => setType(v as FlowType)}>
              <SelectTrigger size="sm" className="w-36" aria-label="Flow type for the new label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLOW_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" size="sm" disabled={!label.trim()}>
              <Plus />
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
