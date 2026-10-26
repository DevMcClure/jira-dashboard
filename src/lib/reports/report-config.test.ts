import { describe, expect, it } from "vitest"
import { createLocalReportStore } from "./local-report-store"
import {
  configFromView,
  decodeReportConfig,
  DEFAULT_REPORT_PAGES,
  encodeReportConfig,
  pageForPath,
  parseReportConfig,
  reportLink,
  viewFromConfig,
  type DashboardView,
  type ReportConfig,
} from "./report-config"

const generatedAt = new Date("2026-10-19T17:00:00Z")
const week = { start: new Date("2026-10-13T00:00:00Z"), end: generatedAt }

/** The plan's acceptance report: Web team, sprint WEB 26.4.4 (id 209), last 7 days, three pages. */
const view: DashboardView = {
  filters: { sprintIds: [209], teamIds: ["TEAM-WEB"], assigneeIds: [] },
  scope: { kind: "sprint" },
  period: "7d",
  range: week,
  generatedAt,
}
const acceptance = configFromView(view, {
  title: "WEB 26.4.4 status",
  author: "Devan",
  kind: "live",
  pages: ["overview", "details", "objectives"],
  landingPage: "overview",
})

describe("reportConfigSchema", () => {
  it("builds a v1 live config from the current view, filling defaults", () => {
    expect(acceptance).toEqual({
      schemaVersion: 1,
      title: "WEB 26.4.4 status",
      note: "",
      author: "Devan",
      kind: "live",
      scope: "sprint",
      piId: null,
      sprintIds: [209],
      teamIds: ["TEAM-WEB"],
      assigneeIds: [],
      period: "7d",
      pages: ["overview", "details", "objectives"],
      landingPage: "overview",
      dataStamp: "2026-10-19T17:00:00.000Z",
    })
  })

  it("pins a frozen report's dates and keeps a PI scope", () => {
    const frozen = configFromView(
      { ...view, scope: { kind: "pi", piId: "PI-26.4" } },
      { title: "Frozen", kind: "frozen", pages: ["pi"], landingPage: "pi" },
    )
    expect(frozen).toMatchObject({
      kind: "frozen",
      scope: "pi",
      piId: "PI-26.4",
      from: "2026-10-13T00:00:00.000Z",
      to: "2026-10-19T17:00:00.000Z",
    })
  })

  it("rejects configs it can't honour", () => {
    const bad: [string, unknown][] = [
      ["no title", { ...acceptance, title: "  " }],
      ["no pages", { ...acceptance, pages: [] }],
      ["landing page not included", { ...acceptance, landingPage: "flow" }],
      ["unknown page", { ...acceptance, pages: ["overview", "admin"] }],
      ["future schema", { ...acceptance, schemaVersion: 2 }],
      ["frozen without dates", { ...acceptance, kind: "frozen" }],
      ["PI scope without a PI", { ...acceptance, scope: "pi" }],
      ["bad period", { ...acceptance, period: "forever" }],
      ["not an object", "hello"],
    ]
    for (const [why, raw] of bad) expect(parseReportConfig(raw), why).toBeNull()
  })

  it("drops unknown fields rather than keeping them", () => {
    expect(parseReportConfig({ ...acceptance, isAdmin: true })).toEqual(acceptance)
  })
})

describe("viewFromConfig", () => {
  it("restores filters, scope and period; live reports have no fixed range", () => {
    expect(viewFromConfig(acceptance)).toEqual({
      filters: { sprintIds: [209], teamIds: ["TEAM-WEB"], assigneeIds: [] },
      scope: { kind: "sprint" },
      period: "7d",
      fixedRange: null,
    })
  })

  it("gives frozen reports their pinned range", () => {
    const frozen: ReportConfig = { ...acceptance, kind: "frozen", from: week.start.toISOString(), to: week.end.toISOString() }
    expect(viewFromConfig(frozen).fixedRange).toEqual(week)
  })
})

describe("links", () => {
  it("round-trips through a URL-safe code, including non-ASCII text", () => {
    const fancy: ReportConfig = { ...acceptance, title: "Équipe Web — sprint ✓", note: "Notes: 日本語" }
    const code = encodeReportConfig(fancy)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeReportConfig(code)).toEqual(fancy)
  })

  it("returns null for tampered, truncated or garbage codes", () => {
    const code = encodeReportConfig(acceptance)
    const flipped = code.slice(0, 20) + (code[20] === "A" ? "B" : "A") + code.slice(21)
    for (const c of [code.slice(0, code.length - 7), flipped, "not base64!", "", null, "e30", "x".repeat(20_000)]) {
      expect(decodeReportConfig(c)).toBeNull()
    }
  })

  it("builds the shareable link under the app's base path", () => {
    const code = encodeReportConfig(acceptance)
    expect(reportLink(acceptance, "https://devmcclure.github.io", "/jira-dashboard/")).toBe(
      `https://devmcclure.github.io/jira-dashboard/r?c=${code}`,
    )
    expect(reportLink(acceptance, "http://localhost:5173", "/")).toBe(`http://localhost:5173/r?c=${code}`)
  })
})

describe("DEFAULT_REPORT_PAGES", () => {
  it("is Overview, Details, PI, Objectives and Flow (answered open question)", () => {
    expect(DEFAULT_REPORT_PAGES).toEqual(["overview", "details", "pi", "objectives", "flow"])
  })
})

describe("pageForPath", () => {
  it("maps paths (and their detail routes) to report pages", () => {
    expect(["/", "/teams/TEAM-WEB", "/objectives", "/tickets/WEB-1", "/flow", "/import", "/nope"].map(pageForPath)).toEqual([
      "overview", "overview", "objectives", "tickets", "flow", null, null,
    ])
  })
})

describe("report store with the schema", () => {
  it("keeps valid reports and drops invalid ones on read", async () => {
    const map = new Map<string, string>()
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
    const store = createLocalReportStore({ parse: parseReportConfig, storage })
    const saved = await store.save({ config: acceptance })
    const stored = JSON.parse(map.get("jira-dashboard:reports")!)
    map.set("jira-dashboard:reports", JSON.stringify([...stored, { ...stored[0], id: "bad", config: { ...acceptance, pages: [] } }]))
    expect((await store.list()).map((r) => r.id)).toEqual([saved.id])
    expect((await store.get(saved.id))?.config).toEqual(acceptance)
  })
})
