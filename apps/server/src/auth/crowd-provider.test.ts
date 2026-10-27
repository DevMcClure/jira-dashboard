import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createCrowdAuthProvider } from "./crowd-provider"
import { InvalidCredentials, ProviderUnavailable } from "./provider"
import { startMockCrowd } from "./testing/mock-crowd"

describe("createCrowdAuthProvider (against a mock Crowd)", () => {
  let crowd: Awaited<ReturnType<typeof startMockCrowd>>
  const app = { name: "jira-dashboard", password: "app-placeholder" }
  beforeAll(async () => {
    crowd = await startMockCrowd({
      app,
      users: {
        "jo.dev": { password: "pw-jo", displayName: "Jo Developer", email: "jo@example.com", groups: ["engineering", "jira-dashboard-authors"] },
        "old.user": { password: "pw-old", displayName: "Old User", email: "old@example.com", groups: [], active: false },
      },
    })
  })
  afterAll(() => crowd.close())
  const provider = () => createCrowdAuthProvider({ CROWD_URL: crowd.url, CROWD_APP_NAME: app.name, CROWD_APP_PASSWORD: app.password })

  it("signs in: creates an SSO token, then reads the user and their nested groups", async () => {
    const { user, token } = await provider().login("jo.dev", "pw-jo")
    expect(user).toEqual({ id: "jo.dev", displayName: "Jo Developer", email: "jo@example.com", groups: ["engineering", "jira-dashboard-authors"] })
    expect(token).toMatch(/^[0-9a-f]{32}$/)
    expect(crowd.calls.slice(-3)).toEqual(["POST /session", "GET /user", "GET /user/group/nested"])
  })

  it("treats a wrong password, an unknown user and an inactive account as invalid credentials", async () => {
    await expect(provider().login("jo.dev", "nope")).rejects.toBeInstanceOf(InvalidCredentials)
    await expect(provider().login("nobody", "x")).rejects.toBeInstanceOf(InvalidCredentials)
    await expect(provider().login("old.user", "pw-old")).rejects.toBeInstanceOf(InvalidCredentials)
  })

  it("validates and ends Crowd sessions", async () => {
    const p = provider()
    const { token } = await p.login("jo.dev", "pw-jo")
    expect(await p.validate({ userId: "jo.dev", token })).toBe(true)
    await p.logout({ userId: "jo.dev", token })
    expect(await p.validate({ userId: "jo.dev", token })).toBe(false)
    expect(await p.validate({ userId: "jo.dev", token: null })).toBe(false)
  })

  it("reports wrong app credentials as a configuration problem, not the user's", async () => {
    const wrongApp = createCrowdAuthProvider({ CROWD_URL: crowd.url, CROWD_APP_NAME: app.name, CROWD_APP_PASSWORD: "wrong" })
    const err = await wrongApp.login("jo.dev", "pw-jo").catch((e) => e)
    expect(err).toBeInstanceOf(ProviderUnavailable)
    expect(err.message).toMatch(/CROWD_APP_NAME/)
    expect(err.message).not.toMatch(/pw-jo|wrong/)
  })

  it("is unavailable when Crowd can't be reached", async () => {
    // A port that was free a moment ago, so nothing is listening.
    const probe = createServer()
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve))
    const { port } = probe.address() as AddressInfo
    await new Promise((resolve) => probe.close(resolve))
    const down = createCrowdAuthProvider({ CROWD_URL: `http://127.0.0.1:${port}/crowd`, CROWD_APP_NAME: app.name, CROWD_APP_PASSWORD: app.password, timeoutMs: 500 })
    const err = await down.login("jo.dev", "pw-jo").catch((e) => e)
    expect(err).toBeInstanceOf(ProviderUnavailable)
    expect(err.message).toBe(`Couldn't reach Crowd at 127.0.0.1:${port} (ECONNREFUSED).`)
  })

  it("says which call failed when Crowd answers unexpectedly, without the token", async () => {
    const p = provider()
    const { token } = await p.login("jo.dev", "pw-jo")
    const broken = createCrowdAuthProvider({
      CROWD_URL: crowd.url,
      CROWD_APP_NAME: app.name,
      CROWD_APP_PASSWORD: app.password,
      fetch: async () => new Response("oops", { status: 500 }),
    })
    const err = await broken.validate({ userId: "jo.dev", token }).catch((e) => e)
    expect(err).toBeInstanceOf(ProviderUnavailable)
    expect(err.message).toBe("Crowd answered 500 to the session check.")
    expect(err.message).not.toContain(token!)
  })

  it("refuses to start without its settings", () => {
    expect(() => createCrowdAuthProvider({ CROWD_URL: crowd.url, CROWD_APP_NAME: undefined, CROWD_APP_PASSWORD: "x" })).toThrow(/incomplete/)
  })
})
