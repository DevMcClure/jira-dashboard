import { Progress } from "@/components/ui/progress"

type Props = {
  /** % done, 0–100. */
  value: number
  /** % of the PI's time gone, 0–100; drawn as a marker. */
  timeGone: number
  label: string
}

/** Progress bar with a thin marker at "time gone", so a bar left of the marker reads as behind. */
export function TimeGoneBar({ value, timeGone, label }: Props) {
  return (
    <div className="relative">
      <Progress value={value} className="h-2" aria-label={label} />
      <span
        aria-hidden
        title={`${Math.round(timeGone)}% of the PI gone`}
        className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-foreground/70"
        style={{ left: `${Math.min(100, Math.max(0, timeGone))}%` }}
      />
    </div>
  )
}
