import { describe, expect, it } from "vitest"
import piFixture from "./__fixtures__/pi-export.json"
import smallFixture from "./__fixtures__/small-export.json"
import { parseExport } from "./adapter"
import { currentPi, currentSprints, inScope, resolveScope, SPRINT_SCOPE, withEpics } from "./scope"

const ds = parseExport(piFixture)
const ids = (xs: { id: number }[]) => xs.map((x) => x.id)

describe("resolveScope", () => {
  it("current sprint: tickets from the active sprint, history from its PI", () => {
    const r = resolveScope(ds, SPRINT_SCOPE)
    expect(r.kind).toBe("sprint")
    expect(r.label).toBe("Current sprint")
    expect(r.pi?.id).toBe("PI-B")
    expect(ids(r.sprints)).toEqual([12])
    expect(ids(r.historySprints)).toEqual([11, 12, 13])
  })

  it("a PI: every sprint in it, for tickets and history", () => {
    const r = resolveScope(ds, { kind: "pi", piId: "PI-A" })
    expect(r).toMatchObject({ kind: "pi", label: "PI A" })
    expect(ids(r.sprints)).toEqual([10])
    expect(ids(r.historySprints)).toEqual([10])
  })

  it("an unknown PI falls back to the current sprint", () => {
    expect(resolveScope(ds, { kind: "pi", piId: "NOPE" }).kind).toBe("sprint")
  })

  it("without PIs, history covers every sprint", () => {
    const small = parseExport(smallFixture)
    const r = resolveScope(small, SPRINT_SCOPE)
    expect(r.pi).toBeNull()
    expect(ids(r.sprints)).toEqual([1])
    expect(ids(r.historySprints)).toEqual([1])
  })
})

describe("currentSprints", () => {
  it("falls back to a team's latest closed sprint when none is active", () => {
    const closed = ds.sprints.map((s) => (s.state === "active" ? { ...s, state: "closed" as const } : s))
    expect(ids(currentSprints(closed))).toEqual([12])
  })
})

describe("currentPi", () => {
  it("prefers the active PI", () => {
    expect(currentPi(ds)?.id).toBe("PI-B")
  })

  it("is null without PIs", () => {
    expect(currentPi(parseExport(smallFixture))).toBeNull()
  })
})

describe("inScope", () => {
  const issue = ds.byKey.get("TST-3")!
  it("matches any of the issue's sprints", () => {
    expect(inScope(issue, new Set([12]))).toBe(true)
    expect(inScope(issue, new Set([13]))).toBe(false)
  })

  it("lets everything through when the scope has no sprints", () => {
    expect(inScope(issue, new Set())).toBe(true)
  })
})

describe("withEpics", () => {
  const keys = (xs: { key: string }[]) => xs.map((x) => x.key)
  const pick = (...k: string[]) => k.map((key) => ds.byKey.get(key)!)

  it("adds each issue's epic once, after the issues", () => {
    expect(keys(withEpics(pick("TST-2", "TST-3", "TST-4"), ds))).toEqual(["TST-2", "TST-3", "TST-4", "TST-E1"])
  })

  it("skips epics already listed and keys missing from the export", () => {
    expect(keys(withEpics(pick("TST-E1", "TST-2"), ds))).toEqual(["TST-E1", "TST-2"])
    expect(keys(withEpics(pick("TST-5"), ds))).toEqual(["TST-5"])
  })
})
