import { describe, expect, it } from "vitest"
import { createMemoryDatasetStore } from "../dataset-store"
import { seedIfEmpty } from "../seed"
import { createSnapshotJob, daysBetween, NoDataError, previousDay } from "./job"
import { createMemorySnapshotStore } from "./store"

const quiet = { info: () => {}, warn: () => {} }
const setup = async (seed = true) => {
  const datasets = createMemoryDatasetStore()
  if (seed) await seedIfEmpty(datasets)
  const snapshots = createMemorySnapshotStore()
  let clock = new Date("2026-10-20T06:00:00Z")
  const job = createSnapshotJob({ datasets, snapshots, log: quiet, now: () => clock })
  return { datasets, snapshots, job, tick: () => (clock = new Date(clock.getTime() + 60_000)) }
}

describe("snapshot job", () => {
  it("writes one snapshot per team, and a rerun changes nothing", async () => {
    const { snapshots, job, tick } = await setup()
    const [first] = await job.run(["2026-10-19"])
    expect(first).toMatchObject({ date: "2026-10-19", teams: [{ result: "written" }, { result: "written" }, { result: "written" }] })
    const before = structuredClone([...snapshots.docs.values()])
    tick()
    const [again] = await job.run(["2026-10-19"])
    expect("teams" in again && again.teams.map((t) => t.result)).toEqual(["unchanged", "unchanged", "unchanged"])
    expect([...snapshots.docs.values()]).toEqual(before) // takenAt and all
  })

  it("records days the data doesn't reach yet as stale, but not days still to come", async () => {
    const { snapshots, job } = await setup() // the job's clock says 20 Oct; the data is from 19 Oct, 17:00
    const results = await job.run(["2026-10-19", "2026-10-20", "2026-10-21"])
    expect(results[0]).toMatchObject({ stale: true }) // generated before that day ended
    expect(results[1]).toMatchObject({ date: "2026-10-20", stale: true, teams: [{ result: "written" }, {}, {}] })
    expect((await snapshots.get("TEAM-PLAT", "2026-10-20"))?.asOf).toBe("2026-10-19T17:00:00.000Z")
    expect(results[2]).toEqual({ date: "2026-10-21", error: "2026-10-21 hasn't happened yet." })
  })

  it("only backfills days the data covers", async () => {
    const { job } = await setup()
    const [result] = await job.run(["2026-10-20"], { backfilled: true })
    expect(result).toEqual({ date: "2026-10-20", error: expect.stringMatching(/after the data's "now"/) })
  })

  it("backfills without replacing snapshots taken on the day, unless forced", async () => {
    const { snapshots, job } = await setup()
    await job.run(["2026-10-15"])
    const backfill = await job.run(["2026-10-14", "2026-10-15"], { backfilled: true })
    expect(backfill.map((r) => "teams" in r && r.teams.map((t) => t.result))).toEqual([
      ["written", "written", "written"],
      ["kept", "kept", "kept"],
    ])
    expect((await snapshots.get("TEAM-PLAT", "2026-10-15"))?.backfilled).toBe(false)
    const forced = await job.run(["2026-10-15"], { backfilled: true, force: true })
    expect("teams" in forced[0] && forced[0].teams.map((t) => t.result)).toEqual(["written", "written", "written"])
    expect((await snapshots.get("TEAM-PLAT", "2026-10-15"))?.backfilled).toBe(true)
  })

  it("rewrites a day when newer data changes it", async () => {
    const { datasets, job } = await setup()
    await job.run(["2026-10-15"])
    const current = (await datasets.current())!
    const { source, generatedAt, counts, sha256, bytes } = current.ingest
    await datasets.insertCurrent({ json: current.json, source, generatedAt, counts, sha256, bytes })
    const [rerun] = await job.run(["2026-10-15"])
    expect("teams" in rerun && rerun.teams.map((t) => t.result)).toEqual(["written", "written", "written"]) // new ingestId
  })

  it("needs data", async () => {
    const { job } = await setup(false)
    await expect(job.run(["2026-10-19"])).rejects.toBeInstanceOf(NoDataError)
  })
})

describe("previousDay / daysBetween", () => {
  it("finds yesterday in the teams' time zone", () => {
    expect(previousDay(new Date("2026-10-20T06:00:00+01:00"), "Europe/London")).toBe("2026-10-19")
    expect(previousDay(new Date("2026-10-26T06:00:00Z"), "Europe/London")).toBe("2026-10-25") // the day clocks went back
    expect(previousDay(new Date("2026-10-20T03:00:00Z"), "America/New_York")).toBe("2026-10-18")
  })

  it("lists days inclusively", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"])
    expect(daysBetween("2026-10-02", "2026-10-01")).toEqual([])
    expect(() => daysBetween("2026-13-01", "2026-12-01")).toThrow()
  })
})
