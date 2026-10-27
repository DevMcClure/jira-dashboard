import { describe, expect, it } from "vitest"
import { dataLineLabel, originLabel } from "./origin-label"

const now = new Date(2026, 9, 20, 9, 30)
const today = new Date(2026, 9, 20, 8, 15)
const earlier = new Date(2026, 9, 18, 8, 15)
const server = (source: "seed" | "push" | "pull" | "upload" | null) => ({ kind: "server" as const, ingestId: "i", source })

describe("dataLineLabel", () => {
  it("shows when a live feed was trawled", () => {
    expect(dataLineLabel(server("push"), today, now)).toBe("Data: live · trawled 08:15")
    expect(dataLineLabel(server("pull"), earlier, now)).toBe("Data: live · trawled 18 Oct, 08:15")
  })

  it("shows the generation date for everything else", () => {
    expect(dataLineLabel(server("seed"), earlier, now)).toBe("Data: server (sample) · generated 18 Oct 2026")
    expect(dataLineLabel(server("upload"), earlier, now)).toBe("Data: server (published file) · generated 18 Oct 2026")
    expect(dataLineLabel(server(null), earlier, now)).toBe("Data: server · generated 18 Oct 2026")
    expect(dataLineLabel({ kind: "sample" }, earlier, now)).toBe("Data: sample · generated 18 Oct 2026")
    expect(dataLineLabel({ kind: "upload", fileName: "mine.json", loadedAt: "" }, earlier, now)).toBe("Data: mine.json · generated 18 Oct 2026")
  })

  it("names server data by how it arrived", () => {
    expect(originLabel(server("pull")).long).toBe("Server: live Trawler feed (pull)")
    expect(originLabel(server("upload")).fileName).toBe("jira-export.server.json")
  })
})
