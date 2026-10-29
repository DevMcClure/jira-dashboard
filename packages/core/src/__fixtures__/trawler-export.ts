/** A template-shaped Trawler export (docs/template.json): sprints and issues, no programIncrements. */
export function trawlerExport(
  sprints: { id: number; name: string; team: string; start?: string; end?: string; state?: string }[],
  issues: {
    key: string
    type?: string
    team?: string
    sprint?: number
    status?: "To Do" | "Done"
    epicKey?: string
    parentKey?: string
    labels?: string[]
    relatedKeys?: string[]
  }[] = [],
) {
  return {
    meta: { source: "jira-trawler", version: "1.0", generatedAt: "2026-10-29T12:00:00Z" },
    teams: [
      { id: "TEAM-PLAT", name: "Platform", projectKey: "PLAT", memberIds: [] },
      { id: "TEAM-WEB", name: "Web", projectKey: "WEB", memberIds: [] },
    ],
    people: [],
    sprints: sprints.map((s) => ({
      id: s.id,
      name: s.name,
      teamId: s.team,
      state: s.state ?? "closed",
      startDate: s.start ?? null,
      endDate: s.end ?? null,
      completeDate: null,
    })),
    issues: issues.map((i) => ({
      key: i.key,
      summary: i.key,
      type: i.type ?? "Story",
      status: i.status ?? "To Do",
      statusCategory: i.status === "Done" ? "done" : "todo",
      teamId: i.team ?? "TEAM-PLAT",
      sprintIds: i.sprint === undefined ? [] : [i.sprint],
      epicKey: i.epicKey ?? null,
      parentKey: i.parentKey ?? null,
      labels: i.labels ?? [],
      relatedKeys: i.relatedKeys ?? [],
      created: "2026-08-01T09:00:00Z",
      changelog: [],
    })),
  }
}
