import { describe, expect, it } from "vitest"
import flowFixture from "./__fixtures__/flow-export.json"
import { parseExport } from "./adapter"
import { flowEfficiency, flowItems } from "./flow"
import { DEFAULT_FLOW_CONFIG, flowConfigProblems, flowTypeOf, isFlowItem, parseFlowConfig, workingHoursLabel, type FlowConfig } from "./flowConfig"
import { buildReport } from "./report"
import { SPRINT_SCOPE } from "./scope"
import { buildSnapshots } from "./snapshot"

const dataset = parseExport(flowFixture)
const withHours = (h: Partial<FlowConfig["workingHours"]>) => ({ ...DEFAULT_FLOW_CONFIG, workingHours: { ...DEFAULT_FLOW_CONFIG.workingHours, ...h } })

describe("parseFlowConfig", () => {
  it("accepts the defaults unchanged", () => {
    expect(parseFlowConfig(structuredClone(DEFAULT_FLOW_CONFIG))).toEqual(DEFAULT_FLOW_CONFIG)
  })

  it("refuses unknown states and types, impossible hours and made-up time zones", () => {
    expect(parseFlowConfig({ ...DEFAULT_FLOW_CONFIG, statusStates: { QA: "busy" } })).toBeNull()
    expect(parseFlowConfig({ ...DEFAULT_FLOW_CONFIG, typeMap: { Story: "Epic" } })).toBeNull()
    expect(flowConfigProblems(withHours({ start: 18, end: 9 }))).toEqual(["workingHours.end: The working day must end after it starts"])
    expect(flowConfigProblems(withHours({ days: [] }))).toEqual(["workingHours.days: Pick at least one working day"])
    expect(flowConfigProblems(withHours({ days: [1, 1] }))).toEqual(["workingHours.days: A day is listed twice"])
    expect(flowConfigProblems(withHours({ timeZone: "Mars/Olympus" }))).toEqual(["workingHours.timeZone: Not a time zone"])
    expect(parseFlowConfig({ statusStates: {} })).toBeNull()
  })

  it("stores label keys lower-case, as they're matched", () => {
    const cfg = parseFlowConfig({ ...DEFAULT_FLOW_CONFIG, labelTypes: { "Tech-Debt": "Debt" } })!
    expect(cfg.labelTypes).toEqual({ "tech-debt": "Debt" })
    expect(flowTypeOf({ type: "Task", labels: ["TECH-DEBT"] }, cfg)).toBe("Debt")
  })
})

describe("workingHoursLabel", () => {
  it("shows consecutive days as a range, others as a list", () => {
    expect(workingHoursLabel(DEFAULT_FLOW_CONFIG.workingHours)).toBe("Mon–Fri 09:00–18:00 (Europe/London)")
    expect(workingHoursLabel({ days: [1, 3, 5], start: 8, end: 16, timeZone: "UTC" })).toBe("Mon, Wed, Fri 08:00–16:00 (UTC)")
  })
})

describe("custom settings change the numbers everywhere they're used", () => {
  // In Review counted as active work instead of waiting.
  const reviewActive: FlowConfig = { ...DEFAULT_FLOW_CONFIG, statusStates: { ...DEFAULT_FLOW_CONFIG.statusStates, "In Review": "active" } }
  const range = { start: new Date("2026-10-12T00:00:00Z"), end: dataset.meta.generatedAt }

  it("in flow efficiency", () => {
    const opts = { mode: "calendar" as const, now: dataset.meta.generatedAt }
    const before = flowEfficiency(flowItems(dataset.issues), range, opts).pct!
    const after = flowEfficiency(flowItems(dataset.issues, reviewActive), range, { ...opts, cfg: reviewActive }).pct!
    expect(after).toBeGreaterThan(before)
  })

  it("in which types count as flow items", () => {
    const epicsCount = { ...DEFAULT_FLOW_CONFIG, excludeTypes: ["Sub-task"] }
    expect(isFlowItem({ type: "Epic" })).toBe(false)
    expect(isFlowItem({ type: "Epic" }, epicsCount)).toBe(true)
  })

  it("in daily snapshots and the Markdown report", () => {
    const opts = { ingestId: null, takenAt: new Date(), backfilled: false }
    const day = "2026-10-21"
    const before = buildSnapshots(dataset, day, opts)[0].flow.efficiency
    const after = buildSnapshots(dataset, day, { ...opts, flowConfig: reviewActive })[0].flow.efficiency
    expect(after).not.toBe(before)

    const report = (flowConfig?: FlowConfig) =>
      buildReport(dataset, { scope: SPRINT_SCOPE, teamIds: [], sprintIds: [], period: "14d", sections: ["flow"], flowConfig })
    expect(report()).toContain("Mon–Fri 09:00–18:00 (Europe/London); a working day is 9 hours")
    expect(report(withHours({ start: 8, end: 16 }))).toContain("Mon–Fri 08:00–16:00 (Europe/London); a working day is 8 hours")
  })
})
