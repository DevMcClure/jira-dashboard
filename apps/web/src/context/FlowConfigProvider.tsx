import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { AppLoading } from "@/components/common/AppLoading"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { API_BASE_URL, DATA_MODE } from "@/lib/data/data-mode"
import {
  createApiFlowSettingsStore,
  createLocalFlowSettingsStore,
  type FlowSettings,
  type FlowSettingsStore,
} from "@/lib/settings/flow-settings-store"
import { DEFAULT_FLOW_CONFIG, type FlowConfig } from "@jira-dashboard/core/flowConfig"
import { FlowConfigContext } from "./flow-config-context"

const defaultStore: FlowSettingsStore = DATA_MODE === "api" ? createApiFlowSettingsStore({ baseUrl: API_BASE_URL }) : createLocalFlowSettingsStore()

/**
 * The flow metric settings every flow number uses: the server's (api mode) or
 * this browser's (static). Loaded once; saving updates every page at once.
 */
export function FlowConfigProvider({ children, store = defaultStore }: { children: ReactNode; store?: FlowSettingsStore }) {
  const [settings, setSettings] = useState<FlowSettings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const isAdmin = useCurrentUser()?.roles.includes("admin") ?? false

  useEffect(() => {
    let live = true
    store.load().then(
      (loaded) => live && setSettings(loaded),
      (err: Error) => {
        if (!live) return
        // Flow numbers still work, on the defaults; the settings page says why.
        setLoadError(err.message)
        setSettings({ config: DEFAULT_FLOW_CONFIG, isDefault: true, updatedAt: null, updatedBy: null })
      },
    )
    return () => {
      live = false
    }
  }, [store])

  const save = useCallback(
    async (config: FlowConfig) => {
      setSettings(await store.save(config))
      setLoadError(null)
    },
    [store],
  )
  const reset = useCallback(async () => {
    setSettings(await store.reset())
    setLoadError(null)
  }, [store])

  const value = useMemo(
    () => settings && { ...settings, loadError, canEdit: DATA_MODE !== "api" || isAdmin, save, reset },
    [settings, loadError, isAdmin, save, reset],
  )
  if (!value) return <AppLoading state="loading" />
  return <FlowConfigContext.Provider value={value}>{children}</FlowConfigContext.Provider>
}
