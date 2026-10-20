import { describe, expect, it } from "vitest"
import { JiraExportError, parseExport, parseExportText } from "./adapter"

const ticket = (over: Record<string, unknown> = {}) => ({
  id: "10001",
  key: "PLAT-1",
  self: "https://jira.example.com/rest/api/2/issue/10001",
  project: "PLAT",
  summary: "Retry failed webhooks",
  issuetype: "Story",
  status: "In Progress",
  statusCategory: "In Progress",
  priority: "High",
  resolution: null,
  assignee: { name: "pshah", key: "JIRAUSER1", displayName: "Priya Shah" },
  reporter: { name: "mchen", key: "JIRAUSER2", displayName: "Marcus Chen" },
  creator: { name: "mchen", key: "JIRAUSER2", displayName: "Marcus Chen" },
  created: "2026-10-01T09:00:00.000+0000",
  updated: "2026-10-15T12:30:00.000+0100",
  resolutiondate: null,
  duedate: "2026-10-30",
  labels: ["backend"],
  components: [],
  fixVersions: [],
  affectsVersions: [],
  parent: null,
  ...over,
})

const project = {
  id: "10000",
  key: "PLAT",
  name: "Platform",
  projectTypeKey: "software",
  lead: { name: "pshah", key: "JIRAUSER1", displayName: "Priya Shah" },
  category: null,
  archived: false,
  description: "",
  self: "https://jira.example.com/rest/api/2/project/10000",
  matchingIssues: 2,
}

const done = ticket({
  key: "PLAT-2",
  status: "Closed",
  statusCategory: "Done",
  assignee: null,
  resolution: "Fixed",
  resolutiondate: "2026-10-14T16:00:00.000+0000",
})

const log = [
  "2026-10-20 08:15:00,123 INFO Connecting to https://jira.example.com",
  '2026-10-20 08:15:00,200 INFO Filters: {"projects": {}, "tickets": {}}',
  "2026-10-20 08:15:01,000 INFO Found 3 visible projects, 1 after project filters",
  `2026-10-20 08:15:01,100 INFO PROJECT ${JSON.stringify(project)}`,
  `2026-10-20 08:15:02,000 INFO TICKET ${JSON.stringify(ticket())}`,
  `2026-10-20 08:15:02,001 INFO TICKET ${JSON.stringify(done)}`,
  "2026-10-20 08:15:03,000 INFO Wrote JSON output to out/trawl.json",
  "2026-10-20 08:15:03,500 INFO Done. projects=1 with_tickets=1 empty_skipped=0 failed=0 json=out/trawl.json",
].join("\n")

describe("Trawler audit log", () => {
  const ds = parseExportText(log)

  it("reads every ticket and maps raw Jira fields", () => {
    expect(ds.issues.map((i) => i.key)).toEqual(["PLAT-1", "PLAT-2"])
    const [a, b] = ds.issues
    expect(a).toMatchObject({
      type: "Story",
      statusCategory: "in_progress",
      assigneeId: "JIRAUSER1",
      reporterId: "JIRAUSER2",
      teamId: "PLAT",
      labels: ["backend"],
      changelog: [],
    })
    expect(a.updated.toISOString()).toBe("2026-10-15T11:30:00.000Z")
    expect(b.statusCategory).toBe("done")
    expect(b.resolved?.toISOString()).toBe("2026-10-14T16:00:00.000Z")
  })

  it("turns projects into teams and collects people", () => {
    expect(ds.teams).toEqual([{ id: "PLAT", name: "Platform", projectKey: "PLAT", memberIds: ["JIRAUSER1"] }])
    expect(ds.personById.get("JIRAUSER1")?.displayName).toBe("Priya Shah")
  })

  it("puts each project's tickets in one active sprint with unknown dates", () => {
    expect(ds.sprints).toEqual([
      {
        id: 1,
        name: "Platform current sprint",
        teamId: "PLAT",
        state: "active",
        goal: null,
        startDate: null,
        endDate: null,
        completeDate: null,
      },
    ])
    expect(ds.issues.every((i) => i.sprintIds[0] === 1)).toBe(true)
  })

  it("takes the base URL and export time from the log", () => {
    expect(ds.meta.jiraBaseUrl).toBe("https://jira.example.com")
    expect(ds.meta.source).toBe("jira-trawler")
    expect(ds.meta.generatedAt.getFullYear()).toBe(2026)
  })

  it("reports a truncated TICKET line", () => {
    expect(() => parseExportText(`${log}\n2026-10-20 08:15:04,000 INFO TICKET {"key": `)).toThrow(/line 9 \(TICKET\)/)
  })
})

describe("Trawler history and story points", () => {
  const priya = { name: "pshah", key: "JIRAUSER1", displayName: "Priya Shah" }
  const histories = [
    {
      author: priya,
      created: "2026-10-02T10:00:00.000+0000",
      items: [
        { field: "status", from: "1", fromString: "To Do", to: "3", toString: "In Progress" },
        // Server history uses the username; the ticket's person uses the key.
        { field: "assignee", from: null, fromString: null, to: "pshah", toString: "Priya Shah" },
      ],
    },
    {
      author: priya,
      created: "2026-10-03T09:00:00.000+0000",
      items: [
        { field: "Story Points", from: null, fromString: "3", to: null, toString: "5" },
        { field: "assignee", from: "jdoe", fromString: "Jo Doe", to: null, toString: null },
      ],
    },
  ]
  const withHistory = ticket({ "Story Points": "5", changelog: { histories } })
  const ds = parseExport({ projects: [project], tickets: [withHistory] })
  const issue = ds.issues[0]

  it("reads story points, including numeric strings", () => {
    expect(issue.storyPoints).toBe(5)
  })

  it("flattens histories into contract changelog entries", () => {
    expect(issue.changelog.map((c) => [c.field, c.from, c.to])).toEqual([
      ["status", "To Do", "In Progress"],
      ["assignee", null, "JIRAUSER1"],
      ["storyPoints", "3", "5"],
      ["assignee", "jdoe", null],
    ])
    expect(issue.changelog[0].authorId).toBe("JIRAUSER1")
    expect(issue.changelog[0].at.toISOString()).toBe("2026-10-02T10:00:00.000Z")
  })

  it("drives status transitions and names people only seen in history", () => {
    expect(ds.transitions.map((t) => [t.from, t.to])).toEqual([["To Do", "In Progress"]])
    expect(ds.personById.get("jdoe")?.displayName).toBe("Jo Doe")
  })

  it("also accepts a plain array of histories", () => {
    const [i] = parseExport([ticket({ storyPoints: 2, changelog: histories })]).issues
    expect(i.storyPoints).toBe(2)
    expect(i.changelog).toHaveLength(4)
  })
})

describe("Trawler JSON output", () => {
  it("accepts projects with nested tickets, one sprint per project", () => {
    const web = { ...project, id: "10002", key: "WEB", name: "Web" }
    const ds = parseExport({
      projects: [
        { ...project, tickets: [ticket(), done] },
        { ...web, tickets: [ticket({ key: "WEB-7", project: "WEB" })] },
      ],
    })
    expect(ds.issues).toHaveLength(3)
    expect(ds.sprints.map((s) => [s.teamId, s.id])).toEqual([
      ["PLAT", 1],
      ["WEB", 2],
    ])
    expect(ds.byKey.get("WEB-7")?.sprintIds).toEqual([2])
    expect(ds.meta.jiraBaseUrl).toBe("https://jira.example.com")
  })

  it("accepts a bare ticket array and infers the team from the key", () => {
    const ds = parseExport([ticket({ project: null, statusCategory: "new", status: "Open" })])
    expect(ds.teams.map((t) => t.id)).toEqual(["PLAT"])
    expect(ds.issues[0].statusCategory).toBe("todo")
  })

  it("rejects tickets missing required fields with a readable path", () => {
    const err = (() => {
      try {
        parseExport({ tickets: [ticket({ summary: undefined })] })
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(JiraExportError)
    expect((err as JiraExportError).problems[0]).toMatch(/^tickets\.0\.summary/)
  })
})
