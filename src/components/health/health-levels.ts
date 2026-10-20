import type { HealthLevel } from "@/lib/jira/metrics"

/** Label + status colour token for each sprint health level. */
export const HEALTH_LEVELS: Record<HealthLevel, { label: string; colorVar: string }> = {
  on_track: { label: "On track", colorVar: "--status-done" },
  at_risk: { label: "At risk", colorVar: "--status-qa" },
  off_track: { label: "Off track", colorVar: "--status-blocked" },
  completed: { label: "Completed", colorVar: "--muted-foreground" },
}
