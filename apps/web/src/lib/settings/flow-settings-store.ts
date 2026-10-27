/**
 * Where the flow metric settings live (docs/decisions/0043): the server in api
 * mode (shared; admins change them), this browser's localStorage in the static
 * build. Pages go through `useFlowConfig()`, never this directly.
 */
import { DEFAULT_FLOW_CONFIG, parseFlowConfig, type FlowConfig } from "@jira-dashboard/core/flowConfig"
import { notifyUnauthorized } from "@/lib/auth/auth-client"

export type FlowSettings = {
  config: FlowConfig
  isDefault: boolean
  /** ISO time of the last change; null for the defaults. */
  updatedAt: string | null
  updatedBy: { id: string; displayName: string } | null
}

export interface FlowSettingsStore {
  load(): Promise<FlowSettings>
  save(config: FlowConfig): Promise<FlowSettings>
  /** Back to the defaults. */
  reset(): Promise<FlowSettings>
}

/** A refused or failed change; `problems` lists what's wrong with the settings when the server said so. */
export class FlowSettingsError extends Error {
  readonly problems: string[]
  constructor(message: string, problems: string[] = []) {
    super(message)
    this.name = "FlowSettingsError"
    this.problems = problems
  }
}

const DEFAULTS: FlowSettings = { config: DEFAULT_FLOW_CONFIG, isDefault: true, updatedAt: null, updatedBy: null }

export const FLOW_SETTINGS_STORAGE_KEY = "jira-dashboard:flow-settings"

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

/** This browser's settings (static build). Anything unreadable or invalid means the defaults. */
export function createLocalFlowSettingsStore({ storage, now = () => new Date() }: { storage?: StorageLike; now?: () => Date } = {}): FlowSettingsStore {
  const store = (): StorageLike => storage ?? globalThis.localStorage
  const read = (): FlowSettings => {
    try {
      const raw = JSON.parse(store().getItem(FLOW_SETTINGS_STORAGE_KEY) ?? "null") as { config?: unknown; updatedAt?: unknown } | null
      const config = raw ? parseFlowConfig(raw.config) : null
      return config ? { config, isDefault: false, updatedAt: typeof raw!.updatedAt === "string" ? raw!.updatedAt : null, updatedBy: null } : DEFAULTS
    } catch {
      return DEFAULTS
    }
  }
  return {
    load: async () => read(),
    async save(config) {
      const valid = parseFlowConfig(config)
      if (!valid) throw new FlowSettingsError("Those settings aren't valid.")
      try {
        store().setItem(FLOW_SETTINGS_STORAGE_KEY, JSON.stringify({ config: valid, updatedAt: now().toISOString() }))
      } catch {
        throw new FlowSettingsError("This browser's storage is blocked or full, so the settings can't be kept.")
      }
      return read()
    },
    async reset() {
      try {
        store().removeItem(FLOW_SETTINGS_STORAGE_KEY)
      } catch {
        // Nothing stored, or storage blocked: either way the defaults apply.
      }
      return DEFAULTS
    },
  }
}

/** The server's shared settings (api mode); only admins may change them, which the server checks. */
export function createApiFlowSettingsStore({ baseUrl, fetch = globalThis.fetch }: { baseUrl: string; fetch?: typeof globalThis.fetch }): FlowSettingsStore {
  const call = async (method: "GET" | "PUT" | "DELETE", body?: unknown): Promise<FlowSettings> => {
    let res: Response
    try {
      res = await fetch(`${baseUrl}/settings/flow`, {
        method,
        credentials: "include",
        headers: { accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch {
      throw new FlowSettingsError(`Couldn't reach the dashboard server at ${baseUrl}.`)
    }
    if (res.status === 401) notifyUnauthorized()
    const json = (await res.json().catch(() => null)) as (FlowSettings & { error?: string; problems?: string[] }) | null
    if (!res.ok || !json) throw new FlowSettingsError(json?.error ?? `The server couldn't do that (${res.status}).`, json?.problems ?? [])
    const config = parseFlowConfig(json.config)
    if (!config) throw new FlowSettingsError("The server sent flow settings this app can't read.")
    return { config, isDefault: json.isDefault, updatedAt: json.updatedAt, updatedBy: json.updatedBy }
  }
  return {
    load: () => call("GET"),
    save: (config) => call("PUT", { config }),
    reset: () => call("DELETE"),
  }
}
