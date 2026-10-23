import { describe, expect, it } from "vitest"
import piFixture from "./__fixtures__/pi-export.json"
import fixture from "./__fixtures__/small-export.json"
import { parseExport } from "./adapter"
import { buildReport, cell, REPORT_SECTIONS, reportScope, type ReportOptions } from "./report"
import { SPRINT_SCOPE } from "./scope"

const ds = parseExport(fixture)
const ALL: ReportOptions = {
  scope: SPRINT_SCOPE,
  teamIds: [],
  sprintIds: [],
  period: "all",
  sections: REPORT_SECTIONS.map((s) => s.value),
}

describe("reportScope", () => {
  it("keeps everything when nothing is selected", () => {
    const scope = reportScope(ds, ALL)
    expect(scope.issues).toHaveLength(ds.issues.length)
    expect(scope.teams).toHaveLength(ds.teams.length)
    expect(scope.now).toEqual(ds.meta.generatedAt)
  })

  it("filters issues and transitions by team", () => {
    const scope = reportScope(ds, { ...ALL, teamIds: ["NOPE"] })
    expect(scope.issues).toEqual([])
    expect(scope.transitions).toEqual([])
    expect(scope.teams).toEqual([])
  })

  it("filters issues by sprint and always shows picked sprints", () => {
    const scope = reportScope(ds, { ...ALL, sprintIds: [1], period: "today" })
    expect(scope.issues.every((i) => i.sprintIds.includes(1))).toBe(true)
    expect(scope.sprints.map((s) => s.id)).toEqual([1])
  })
})

describe("buildReport", () => {
  const md = buildReport(ds, ALL)

  it("has a title, scope lines and every section", () => {
    expect(md).toMatch(/^# Sprint report: All teams\n/)
    expect(md).toContain("- **Sprints:** Current sprint")
    expect(md).toContain("- **Period:** All time (5 Oct 2026 – 8 Oct 2026)")
    for (const h of ["## Summary", "## Teams", "### Test (TST)", "## Sprints", "## Status breakdown", "## People", "## Movements (All time)"]) {
      expect(md).toContain(h)
    }
  })

  it("reports headline numbers from metrics", () => {
    expect(md).toContain(`| Tickets | ${ds.issues.length} |`)
    expect(md).toMatch(/\| TST Sprint 1 \| Test \| active \|/)
    expect(md).toContain("**TST Sprint 1:** Prove the metrics")
  })

  it("links tickets to Jira when a base URL is known", () => {
    expect(md).toContain("[TST-2](https://example.atlassian.net/browse/TST-2)")
  })

  it("only includes the chosen sections", () => {
    const only = buildReport(ds, { ...ALL, sections: ["people"] })
    expect(only).toContain("## People")
    expect(only).not.toContain("## Summary")
    expect(only).not.toContain("## Movements")
  })

  it("names the selected teams and sprints", () => {
    const md = buildReport(ds, { ...ALL, teamIds: ["TEAM-TST"], sprintIds: [1] })
    expect(md).toMatch(/^# Sprint report: Test\n/)
    expect(md).toContain("- **Sprints:** TST Sprint 1")
  })

  it("says so when the scope is empty", () => {
    const empty = buildReport(ds, { ...ALL, teamIds: ["NOPE"] })
    expect(empty).toContain("_No teams in scope._")
    expect(empty).toContain("_No tickets in scope._")
    expect(empty).toContain("_No status moves in this period._")
  })
})

describe("buildReport with PIs", () => {
  const pds = parseExport(piFixture)
  const opts: ReportOptions = { ...ALL, period: "pi" }

  it("current sprint scope covers the active sprint and names its PI", () => {
    const md = buildReport(pds, opts)
    expect(md).toMatch(/^# Sprint report: All teams\n/)
    expect(md).toContain("- **PI:** PI B (28 Sep 2026 – 23 Oct 2026)")
    expect(md).toContain("- **Period:** This PI (28 Sep 2026 – 8 Oct 2026)")
    expect(md).toContain(`| Tickets | 2 |`) // TST-3 and TST-4 are in sprint 2
  })

  it("a PI scope covers every sprint in it", () => {
    const md = buildReport(pds, { ...opts, scope: { kind: "pi", piId: "PI-B" } })
    expect(md).toMatch(/^# PI B report: All teams\n/)
    expect(md).toContain("- **Sprints:** All sprints in PI B")
    expect(md).toContain(`| Tickets | 4 |`)
    expect(md).toMatch(/\| TST Sprint 3 \| Test \| future \| .* \| Planned \|/)
  })

  it("has a PI section with health, points per sprint and epics", () => {
    const md = buildReport(pds, { ...opts, sections: ["pi"] })
    expect(md).toContain("## Program increment")
    expect(md).toContain("**PI B**: At risk. 23% of points done with 40% of the PI gone (3 / 13 pts, 4 tickets, 16 days left).")
    expect(md).toContain("- Ship it")
    expect(md).toContain("| TST Sprint 1 | Test | closed | 0 pts | 3 pts |")
    expect(md).toContain("| Epic one ([TST-E1](https://example.atlassian.net/browse/TST-E1)) | Test | 60% | 1 / 2 | 3 / 5 |")
  })

  it("says so when there are no PIs", () => {
    expect(buildReport(ds, { ...ALL, sections: ["pi"] })).toContain("_This export has no program increments._")
  })
})

describe("cell", () => {
  it("escapes pipes and flattens newlines", () => {
    expect(cell("a | b\n  c")).toBe("a \\| b c")
  })
})
