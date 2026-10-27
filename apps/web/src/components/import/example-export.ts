/** Short example shown in the Import page's "Expected format" section (see docs/02-DATA_CONTRACT.md). */
export const EXAMPLE_EXPORT = `{
  "meta": {
    "source": "jira-trawler",
    "version": "1.0",
    "generatedAt": "2026-10-19T17:00:00Z",
    "jiraBaseUrl": "https://example.atlassian.net"
  },
  "teams":   [{ "id": "TEAM-PLAT", "name": "Platform", "projectKey": "PLAT", "memberIds": ["u-01"] }],
  "people":  [{ "id": "u-01", "displayName": "Priya Shah" }],
  "sprints": [{
    "id": 101, "name": "PLAT 26.4.2", "teamId": "TEAM-PLAT", "state": "active",
    "startDate": "2026-10-12T09:00:00Z", "endDate": "2026-10-23T17:00:00Z", "completeDate": null
  }],
  "issues": [{
    "key": "PLAT-1234",
    "summary": "Retry failed webhook deliveries",
    "type": "Story",
    "status": "In Progress",
    "statusCategory": "in_progress",        // "todo" | "in_progress" | "done"
    "priority": "High",
    "assigneeId": "u-01",                   // null = unassigned
    "teamId": "TEAM-PLAT",
    "sprintIds": [101],
    "storyPoints": 5,
    "created": "2026-10-10T11:22:00Z",
    "resolved": null,
    "changelog": [
      { "at": "2026-10-13T10:00:00Z", "authorId": "u-01",
        "field": "status", "from": "To Do", "to": "In Progress" }
    ]
  }]
}`

export const REQUIRED_FIELDS = [
  "issues[] — the only required top-level section",
  "issue.key, summary, status, statusCategory, created",
  "changelog[] is optional, but without it movement, cycle-time and burndown charts have no history",
]
