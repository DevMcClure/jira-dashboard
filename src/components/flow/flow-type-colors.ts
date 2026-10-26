import type { FlowType } from "@/lib/jira/flowConfig"

/** CSS token per flow type (the validated categorical palette in index.css; "Other" is neutral). */
const VAR: Record<FlowType, string> = {
  Feature: "--flow-feature",
  Defect: "--flow-defect",
  Risk: "--flow-risk",
  Debt: "--flow-debt",
  Other: "--flow-other",
}

export const flowTypeVar = (t: FlowType) => VAR[t]
