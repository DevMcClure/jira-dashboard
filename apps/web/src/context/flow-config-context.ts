import { createContext } from "react"
import type { FlowConfig } from "@jira-dashboard/core/flowConfig"
import type { FlowSettings } from "@/lib/settings/flow-settings-store"

export type FlowConfigContextValue = FlowSettings & {
  /** Why the saved settings couldn't be loaded (the defaults apply meanwhile), or null. */
  loadError: string | null
  /** Admins with the server; anyone in the static build (it's their browser). */
  canEdit: boolean
  /** Throws FlowSettingsError (with the server's problems) when refused. */
  save: (config: FlowConfig) => Promise<void>
  reset: () => Promise<void>
}

export const FlowConfigContext = createContext<FlowConfigContextValue | null>(null)
