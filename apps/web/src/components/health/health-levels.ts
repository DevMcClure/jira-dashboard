import type { ObjectiveHealthLevel } from "@jira-dashboard/core/metrics"

/** Label + status colour token for each health level (sprints, PIs and objectives). */
export const HEALTH_LEVELS: Record<ObjectiveHealthLevel, { label: string; colorVar: string }> = {
  on_track: { label: "On track", colorVar: "--status-done" },
  at_risk: { label: "At risk", colorVar: "--status-qa" },
  off_track: { label: "Off track", colorVar: "--status-blocked" },
  completed: { label: "Completed", colorVar: "--muted-foreground" },
  // Objectives only: nothing is linked to roll up.
  no_data: { label: "No tickets", colorVar: "--muted-foreground" },
}
