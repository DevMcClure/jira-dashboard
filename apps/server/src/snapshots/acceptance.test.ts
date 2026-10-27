/**
 * B4 acceptance: snapshots rebuilt from the changelog for PI 26.4 show the
 * same burndown, day by day, as the dashboard's live chart.
 */
import { parseExportText } from "@jira-dashboard/core/adapter"
import { burndown } from "@jira-dashboard/core/metrics"
import { buildSnapshots, dayKey } from "@jira-dashboard/core/snapshot"
import { describe, expect, it } from "vitest"
import { SAMPLE_JSON } from "../seed"

const dataset = parseExportText(SAMPLE_JSON)
const now = dataset.meta.generatedAt
const pi = dataset.piById.get("PI-26.4")!

describe("backfilled PI 26.4", () => {
  const sprints = pi.sprintIds.map((id) => dataset.sprintById.get(id)!).filter((s) => s.startDate! <= now)

  it("covers every team's started sprints", () => {
    expect(new Set(sprints.map((s) => s.teamId)).size).toBe(3)
    expect(sprints.length).toBeGreaterThanOrEqual(9)
  })

  // Rebuilds the full mock data for each of ~130 days: slow when every package's tests run at once.
  it("matches the live burndown on every sprint day up to now", { timeout: 30_000 }, () => {
    let compared = 0
    for (const sprint of sprints) {
      const live = burndown(sprint, dataset.issues, now)
      for (const point of live) {
        if (point.remaining === null || point.date > now) continue
        const day = dayKey(point.date)
        const snapshot = buildSnapshots(dataset, day, { ingestId: null, takenAt: now, backfilled: true }).find((s) => s.teamId === sprint.teamId)!
        expect(snapshot.sprint?.id, `${day} belongs to ${sprint.name}`).toBe(sprint.id)
        expect({ day, sprint: sprint.name, remaining: snapshot.burndown?.remaining }).toEqual({ day, sprint: sprint.name, remaining: point.remaining })
        compared++
      }
    }
    expect(compared).toBeGreaterThan(100)
  })
})
