import { CalendarDays } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useData } from "@/hooks/useData"
import { PERIODS, type Period } from "@/lib/jira/period"

/** Header time-period control. Defaults to Today; drives every activity view. */
export function PeriodPicker() {
  const { dataset, period, setPeriod } = useData()
  // "This PI" only means something when the export has PIs.
  const periods = dataset.programIncrements.length ? PERIODS : PERIODS.filter((p) => p.value !== "pi")
  return (
    <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
      <SelectTrigger size="sm" className="h-8 gap-1.5" aria-label="Time period">
        <CalendarDays className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {periods.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
