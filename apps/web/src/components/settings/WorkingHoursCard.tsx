import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { withWorkingHours } from "@/lib/settings/flow-settings-editor"
import type { FlowConfig } from "@jira-dashboard/core/flowConfig"
import { TimeZonePicker } from "./TimeZonePicker"

const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [7, "Sun"],
] as const
const hour = (h: number) => `${String(h).padStart(2, "0")}:00`

type Props = { config: FlowConfig; disabled: boolean; onChange: (next: FlowConfig) => void }

/** The clock "working hours" times use: which days, which hours, which time zone. */
export function WorkingHoursCard({ config, disabled, onChange }: Props) {
  const h = config.workingHours
  return (
    <Card>
      <CardHeader>
        <CardTitle>Working hours</CardTitle>
        <CardDescription>
          Flow times in working hours only count these hours, so a working day is {h.end - h.start} hours. Calendar time (the switch on the Flow page)
          counts every hour.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="grid gap-1.5">
          <Label>Days</Label>
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            value={h.days.map(String)}
            onValueChange={(v) => onChange(withWorkingHours(config, { days: v.map(Number) }))}
            disabled={disabled}
            aria-label="Working days"
          >
            {DAYS.map(([n, name]) => (
              <ToggleGroupItem key={n} value={String(n)} className="px-2.5">
                {name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid gap-1.5">
          <Label>From</Label>
          <Select value={String(h.start)} onValueChange={(v) => onChange(withWorkingHours(config, { start: Number(v) }))} disabled={disabled}>
            <SelectTrigger size="sm" className="w-24" aria-label="Start of the working day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {hour(i)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>To</Label>
          <Select value={String(h.end)} onValueChange={(v) => onChange(withWorkingHours(config, { end: Number(v) }))} disabled={disabled}>
            <SelectTrigger size="sm" className="w-24" aria-label="End of the working day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {hour(i + 1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Time zone</Label>
          <TimeZonePicker value={h.timeZone} onChange={(timeZone) => onChange(withWorkingHours(config, { timeZone }))} disabled={disabled} />
        </div>
      </CardContent>
    </Card>
  )
}
