import { useContext } from "react"
import { FlowConfigContext } from "@/context/flow-config-context"

/** The active flow settings, and (for the settings page) who may change them. */
export function useFlowConfig() {
  const ctx = useContext(FlowConfigContext)
  if (!ctx) throw new Error("useFlowConfig must be used inside <FlowConfigProvider>")
  return ctx
}
