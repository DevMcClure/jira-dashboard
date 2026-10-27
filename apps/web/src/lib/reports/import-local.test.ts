import { describe, expect, it } from "vitest"
import { importLocalReports } from "./import-local"
import { createLocalReportStore } from "./local-report-store"
import { ReportStoreError, type ReportStore } from "./report-store"

type C = { title: string }
const memoryStorage = () => {
  const items = new Map<string, string>()
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) }
}

describe("importLocalReports", () => {
  it("moves each report to the server, keeping any the server refuses", async () => {
    const local = createLocalReportStore<C>({ parse: (raw) => raw as C, storage: memoryStorage() })
    for (const title of ["Sprint status", "Old frozen one", "PI review"]) await local.save({ config: { title } })
    const saved: string[] = []
    const server = {
      async save({ config }: { config: C }) {
        if (config.title === "Old frozen one") throw new ReportStoreError(409, "A frozen report must be made from the server's current data.")
        saved.push(config.title)
        return { id: "x", createdAt: "", updatedAt: "", config }
      },
    } as unknown as ReportStore<C>

    const result = await importLocalReports(local, server)
    expect(result).toEqual({ imported: 2, failed: [{ title: "Old frozen one", reason: "A frozen report must be made from the server's current data." }] })
    expect(saved.sort()).toEqual(["PI review", "Sprint status"])
    expect((await local.list()).map((r) => r.config.title)).toEqual(["Old frozen one"])
  })
})
