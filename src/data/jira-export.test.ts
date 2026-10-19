import { describe, expect, it } from "vitest"
import { parseExport } from "@/lib/jira/adapter"
import { sprintHealth } from "@/lib/jira/metrics"
import raw from "./jira-export.json"

/** Guards the consistency rules from docs/02-DATA_CONTRACT.md → "Mock data generator". */
describe("bundled mock export", () => {
  const ds = parseExport(raw)

  it("validates and has the expected size", () => {
    expect(ds.issues.length).toBeGreaterThanOrEqual(160)
    expect(ds.teams).toHaveLength(3)
    expect(ds.sprints).toHaveLength(12)
    expect(ds.meta.generatedAt.toISOString()).toBe("2026-10-19T08:00:00.000Z")
  })

  it("has internally consistent changelogs", () => {
    for (const issue of ds.issues) {
      const statusChanges = issue.changelog.filter((c) => c.field === "status")
      const last = statusChanges.at(-1)
      expect(last?.to ?? "To Do", issue.key).toBe(issue.status)
      if (statusChanges.length) expect(statusChanges[0].from, issue.key).toBe("To Do")
      for (let i = 1; i < statusChanges.length; i++) {
        expect(statusChanges[i].from, issue.key).toBe(statusChanges[i - 1].to)
      }
      for (const c of issue.changelog) {
        expect(c.at >= issue.created, issue.key).toBe(true)
        expect(c.at <= ds.meta.generatedAt, issue.key).toBe(true)
      }
      if (issue.status === "Done") {
        expect(issue.resolved?.getTime(), issue.key).toBe(last?.at.getTime())
      } else {
        expect(issue.resolved, issue.key).toBeNull()
      }
      expect(issue.updated.getTime(), issue.key).toBe(
        (issue.changelog.at(-1)?.at ?? issue.created).getTime(),
      )
    }
  })

  it("only moves tickets on weekdays during working hours", () => {
    for (const t of ds.transitions) {
      const day = t.at.getUTCDay()
      expect(day >= 1 && day <= 5, `${t.issueKey} @ ${t.at.toISOString()}`).toBe(true)
      expect(t.at.getUTCHours() >= 9 && t.at.getUTCHours() < 18, t.issueKey).toBe(true)
    }
  })

  it("marks carry-overs with two sprints and a sprint changelog entry", () => {
    const carried = ds.issues.filter((i) => i.sprintIds.length > 1)
    expect(carried.length).toBeGreaterThan(0)
    for (const i of carried) expect(i.changelog.some((c) => c.field === "sprint"), i.key).toBe(true)
  })

  it("has one active sprint per team at roughly 60% elapsed", () => {
    const active = ds.sprints.filter((s) => s.state === "active")
    expect(active).toHaveLength(3)
    for (const s of active) {
      const { pctElapsed } = sprintHealth(s, ds.issues, ds.meta.generatedAt)
      expect(pctElapsed).toBeGreaterThan(50)
      expect(pctElapsed).toBeLessThan(70)
    }
  })
})
