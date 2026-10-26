import { format } from "date-fns"
import type { Bucket } from "@jira-dashboard/core/metrics"

/** X-axis label for a time bucket: "14:00" for hours, "19 Oct" for days. */
export function bucketLabel(date: Date, bucket: Bucket): string {
  return format(date, bucket === "hour" ? "HH:mm" : "d MMM")
}
