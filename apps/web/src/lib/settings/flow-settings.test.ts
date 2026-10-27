import { DEFAULT_FLOW_CONFIG } from "@jira-dashboard/core/flowConfig"
import { describe, expect, it, vi } from "vitest"
import {
  sameSettings,
  statusRows,
  typeRows,
  withCountsAsItem,
  withLabel,
  withStatusState,
  withTypeMapping,
  withWorkingHours,
} from "./flow-settings-editor"
import { createApiFlowSettingsStore, createLocalFlowSettingsStore, FlowSettingsError, FLOW_SETTINGS_STORAGE_KEY } from "./flow-settings-store"

const cfg = DEFAULT_FLOW_CONFIG
const memoryStorage = () => {
  const items = new Map<string, string>()
  return { items, getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), removeItem: (k: string) => void items.delete(k) }
}

describe("flow settings editor", () => {
  it("lists every status, showing which follow their Jira category", () => {
    const rows = statusRows(withStatusState(cfg, "Ready for QA", "waiting"), [
      { name: "To Do", category: "todo", colorVar: "" },
      { name: "In Progress", category: "in_progress", colorVar: "" },
      { name: "Deploying", category: "in_progress", colorVar: "" },
    ])
    expect(rows.find((r) => r.name === "Deploying")).toEqual({ name: "Deploying", category: "in_progress", state: null, fromCategory: "active" })
    expect(rows.find((r) => r.name === "Ready for QA")?.state).toBe("waiting")
    expect(rows.map((r) => r.name)).toContain("Done") // named in the settings, absent from the data
  })

  it("sets and clears status states, type mappings, exclusions and labels", () => {
    expect(withStatusState(cfg, "In Review", null).statusStates).not.toHaveProperty("In Review")
    expect(withTypeMapping(cfg, "Task", "Debt").typeMap.Task).toBe("Debt")
    expect(withTypeMapping(cfg, "Bug", null).typeMap).not.toHaveProperty("Bug")
    expect(withCountsAsItem(cfg, "Epic", true).excludeTypes).toEqual(["Sub-task"])
    expect(withCountsAsItem(cfg, "Spike", false).excludeTypes).toEqual(["Epic", "Sub-task", "Spike"])
    expect(withLabel(cfg, " Security ", "Risk").labelTypes.security).toBe("Risk")
    expect(withLabel(cfg, "risk", null).labelTypes).toEqual({ "tech-debt": "Debt" })
    expect(typeRows(cfg, ["Story", "Task"]).map((r) => [r.name, r.flowType, r.countsAsItem])).toEqual([
      ["Bug", "Defect", true],
      ["Epic", "Feature", false],
      ["Story", "Feature", true],
      ["Sub-task", null, false],
      ["Task", null, true],
    ])
  })

  it("keeps working days in order, and compares settings regardless of order", () => {
    const edited = withWorkingHours(cfg, { days: [5, 1, 3] })
    expect(edited.workingHours.days).toEqual([1, 3, 5])
    expect(sameSettings(cfg, structuredClone(cfg))).toBe(true)
    expect(sameSettings(cfg, { ...cfg, excludeTypes: ["Sub-task", "Epic"] })).toBe(true)
    expect(sameSettings(cfg, edited)).toBe(false)
  })
})

describe("flow settings stores", () => {
  it("keeps this browser's settings, falling back to the defaults for anything invalid", async () => {
    const storage = memoryStorage()
    const store = createLocalFlowSettingsStore({ storage, now: () => new Date("2026-10-20T06:00:00Z") })
    expect(await store.load()).toMatchObject({ isDefault: true, config: cfg })
    const saved = await store.save(withStatusState(cfg, "In Review", "active"))
    expect(saved).toMatchObject({ isDefault: false, updatedAt: "2026-10-20T06:00:00.000Z" })
    expect((await store.load()).config.statusStates["In Review"]).toBe("active")
    storage.items.set(FLOW_SETTINGS_STORAGE_KEY, '{"config":{"statusStates":"nope"}}')
    expect((await store.load()).isDefault).toBe(true)
    await expect(store.save({ ...cfg, workingHours: { ...cfg.workingHours, days: [] } })).rejects.toBeInstanceOf(FlowSettingsError)
    expect(await store.reset()).toMatchObject({ isDefault: true })
  })

  it("reads and changes the server's settings, passing on its problems", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    fetch.mockResolvedValueOnce(Response.json({ config: cfg, isDefault: true, updatedAt: null, updatedBy: null }))
    fetch.mockResolvedValueOnce(Response.json({ error: "Those settings aren't valid.", problems: ["workingHours.end: The working day must end after it starts"] }, { status: 400 }))
    fetch.mockResolvedValueOnce(Response.json({ error: "This needs the admin role." }, { status: 403 }))
    const store = createApiFlowSettingsStore({ baseUrl: "/api", fetch })
    expect(await store.load()).toMatchObject({ isDefault: true })
    const bad = await store.save(cfg).catch((e) => e)
    expect(bad).toMatchObject({ message: "Those settings aren't valid.", problems: ["workingHours.end: The working day must end after it starts"] })
    await expect(store.reset()).rejects.toThrow("This needs the admin role.")
    expect(fetch.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/settings/flow", "GET"],
      ["/api/settings/flow", "PUT"],
      ["/api/settings/flow", "DELETE"],
    ])
  })
})
