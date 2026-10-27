import { afterEach, describe, expect, it } from "vitest"
import { makeApp, signIn } from "../testkit"
import { createCrowdAuthProvider } from "./crowd-provider"
import { createMockAuthProvider } from "./mock-provider"
import { ProviderUnavailable, type AuthProvider } from "./provider"
import { LOGIN_ATTEMPTS_PER_MINUTE } from "./routes"
import { startMockCrowd } from "./testing/mock-crowd"

const apps: Awaited<ReturnType<typeof makeApp>>["app"][] = []
const make = async (opts: Parameters<typeof makeApp>[0] = {}) => {
  const made = await makeApp(opts)
  apps.push(made.app)
  return made
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
})

/** A controllable clock for session expiry and revalidation. */
const clock = (start = "2026-03-02T09:00:00Z") => {
  let at = new Date(start)
  return { now: () => at, advance: (minutes: number) => (at = new Date(at.getTime() + minutes * 60_000)) }
}

const login = (app: Awaited<ReturnType<typeof make>>["app"], username: string, password = "", headers = {}) =>
  app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password }, headers })

describe("POST /api/auth/login", () => {
  it("sets a signed, httpOnly, SameSite=Lax session cookie and returns the user and roles", async () => {
    const { app, authStore } = await make()
    const res = await login(app, "ada.admin")
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      user: { id: "ada.admin", displayName: "Ada Park", email: "ada.park@example.com" },
      roles: ["admin", "author", "viewer"],
    })
    const cookie = String(res.headers["set-cookie"])
    expect(cookie).toMatch(/^jd_session=[\w-]{43}\.[\w%+/=-]+;/) // id + signature
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toMatch(/Expires=/)
    expect(cookie).not.toMatch(/Secure/)
    expect(authStore.sessions.size).toBe(1)
    expect(authStore.users.get("ada.admin")).toMatchObject({ displayName: "Ada Park", groups: ["jira-dashboard-admins"] })
  })

  it("scopes the cookie to BASE_PATH and marks it Secure behind a trusted HTTPS proxy", async () => {
    const { app } = await make({ env: { BASE_PATH: "/dash", TRUST_PROXY: "true" } })
    const res = await app.inject({
      method: "POST",
      url: "/dash/api/auth/login",
      payload: { username: "sam.scrum" },
      headers: { "x-forwarded-proto": "https" },
    })
    const cookie = String(res.headers["set-cookie"])
    expect(cookie).toMatch(/Path=\/dash/)
    expect(cookie).toMatch(/Secure/)
  })

  it("ignores X-Forwarded-Proto unless TRUST_PROXY is on", async () => {
    const { app } = await make()
    const res = await login(app, "sam.scrum", "", { "x-forwarded-proto": "https" })
    expect(String(res.headers["set-cookie"])).not.toMatch(/Secure/)
  })

  it("refuses unknown users with a generic message, and a missing username with 400", async () => {
    const { app, authStore } = await make()
    const bad = await login(app, "mallory")
    expect(bad.statusCode).toBe(401)
    expect(bad.json()).toEqual({ error: "That username and password didn't work." })
    expect(bad.headers["set-cookie"]).toBeUndefined()
    expect((await login(app, "  ")).statusCode).toBe(400)
    expect(authStore.sessions.size).toBe(0)
  })

  it(`allows ${LOGIN_ATTEMPTS_PER_MINUTE} attempts a minute, then 429`, async () => {
    const { app } = await make()
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_MINUTE; i++) expect((await login(app, "mallory")).statusCode).toBe(401)
    const limited = await login(app, "sam.scrum")
    expect(limited.statusCode).toBe(429)
    // Other routes aren't limited.
    expect((await app.inject({ url: "/api/config" })).statusCode).toBe(200)
  })

  it("says 503 (without details) when the provider is down", async () => {
    const down: AuthProvider = {
      ...createMockAuthProvider({ ROLE_GROUPS_ADMIN: [], ROLE_GROUPS_AUTHOR: [] }),
      login: async () => {
        throw new ProviderUnavailable("connect ECONNREFUSED 10.0.0.1:443")
      },
    }
    const { app } = await make({ provider: () => down })
    const res = await login(app, "sam.scrum")
    expect(res.statusCode).toBe(503)
    expect(res.body).not.toMatch(/ECONNREFUSED|10\.0\.0\.1/)
  })
})

describe("session checks", () => {
  it("/auth/me and /dataset need a session; a tampered or unsigned cookie is refused", async () => {
    const { app } = await make()
    expect((await app.inject({ url: "/api/dataset" })).statusCode).toBe(401)
    expect((await app.inject({ url: "/api/auth/me" })).json()).toEqual({ error: "Sign in to continue." })

    const cookie = await signIn(app)
    const me = await app.inject({ url: "/api/auth/me", headers: { cookie } })
    expect(me.json()).toEqual({ user: { id: "sam.scrum", displayName: "Sam Rivers", email: "sam.rivers@example.com" }, roles: ["author", "viewer"] })
    expect((await app.inject({ url: "/api/dataset", headers: { cookie } })).statusCode).toBe(200)

    const [name, value] = cookie.split("=")
    const id = decodeURIComponent(value).split(".")[0]
    const tampered = `${name}=${encodeURIComponent(`${id.slice(0, -1)}x.${decodeURIComponent(value).split(".")[1]}`)}`
    expect((await app.inject({ url: "/api/dataset", headers: { cookie: tampered } })).statusCode).toBe(401)
    expect((await app.inject({ url: "/api/dataset", headers: { cookie: `${name}=${id}` } })).statusCode).toBe(401)
  })

  it("ends at SESSION_TTL_HOURS and removes the expired session", async () => {
    const time = clock()
    const { app, authStore } = await make({ env: { SESSION_TTL_HOURS: "8" }, now: time.now })
    const cookie = await signIn(app)
    time.advance(8 * 60 - 1)
    expect((await app.inject({ url: "/api/dataset", headers: { cookie } })).statusCode).toBe(200)
    time.advance(1)
    const res = await app.inject({ url: "/api/dataset", headers: { cookie } })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: "Your session has ended. Sign in again." })
    expect(authStore.sessions.size).toBe(0)
  })

  it("revalidates with the provider every CROWD_REVALIDATE_MINUTES and picks up group changes", async () => {
    const time = clock()
    const base = createMockAuthProvider({ ROLE_GROUPS_ADMIN: ["jira-dashboard-admins"], ROLE_GROUPS_AUTHOR: ["jira-dashboard-authors"] })
    let groups = ["jira-dashboard-authors"]
    let valid = true
    const calls: string[] = []
    const provider: AuthProvider = {
      ...base,
      validate: async () => (calls.push("validate"), valid),
      groupsFor: async () => (calls.push("groupsFor"), groups),
    }
    const { app, authStore } = await make({ env: { CROWD_REVALIDATE_MINUTES: "15" }, now: time.now, provider: () => provider })
    const cookie = await signIn(app)
    const me = async () => app.inject({ url: "/api/auth/me", headers: { cookie } })

    time.advance(14)
    expect((await me()).json().roles).toEqual(["author", "viewer"])
    expect(calls).toEqual([])

    groups = ["jira-dashboard-admins"]
    time.advance(1)
    expect((await me()).json().roles).toEqual(["admin", "author", "viewer"])
    expect(calls).toEqual(["validate", "groupsFor"])
    expect(authStore.users.get("sam.scrum")?.groups).toEqual(["jira-dashboard-admins"])

    // Not again until another interval has passed.
    time.advance(5)
    await me()
    expect(calls).toHaveLength(2)

    valid = false
    time.advance(15)
    expect((await me()).statusCode).toBe(401)
    expect(authStore.sessions.size).toBe(0)
  })

  it("keeps the session (503) when the provider can't be reached to revalidate", async () => {
    const time = clock()
    let reachable = true
    const base = createMockAuthProvider({ ROLE_GROUPS_ADMIN: [], ROLE_GROUPS_AUTHOR: [] })
    const provider: AuthProvider = {
      ...base,
      validate: async (s) => {
        if (!reachable) throw new ProviderUnavailable()
        return base.validate(s)
      },
    }
    const { app, authStore } = await make({ now: time.now, provider: () => provider })
    const cookie = await signIn(app)
    reachable = false
    time.advance(20)
    expect((await app.inject({ url: "/api/dataset", headers: { cookie } })).statusCode).toBe(503)
    expect(authStore.sessions.size).toBe(1)
    reachable = true
    expect((await app.inject({ url: "/api/dataset", headers: { cookie } })).statusCode).toBe(200)
  })

  it("stores the provider's token encrypted, never in the clear", async () => {
    const base = createMockAuthProvider({ ROLE_GROUPS_ADMIN: [], ROLE_GROUPS_AUTHOR: [] })
    const seen: (string | null)[] = []
    const provider: AuthProvider = {
      ...base,
      login: async (u, p) => ({ ...(await base.login(u, p)), token: "provider-token-abc" }),
      logout: async (s) => void seen.push(s.token),
    }
    const { app, authStore } = await make({ provider: () => provider })
    const cookie = await signIn(app)
    const [session] = authStore.sessions.values()
    expect(session.crowdToken).toMatch(/^v1\./)
    expect(JSON.stringify(session)).not.toContain("provider-token-abc")
    await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } })
    expect(seen).toEqual(["provider-token-abc"])
  })
})

describe("POST /api/auth/logout", () => {
  it("ends the session and clears the cookie", async () => {
    const { app, authStore } = await make()
    const cookie = await signIn(app)
    const res = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } })
    expect(res.statusCode).toBe(204)
    expect(String(res.headers["set-cookie"])).toMatch(/^jd_session=;.*Expires=Thu, 01 Jan 1970/)
    expect(authStore.sessions.size).toBe(0)
    expect((await app.inject({ url: "/api/dataset", headers: { cookie } })).statusCode).toBe(401)
  })

  it("is harmless without a session", async () => {
    const { app } = await make()
    expect((await app.inject({ method: "POST", url: "/api/auth/logout" })).statusCode).toBe(204)
  })
})

describe("GET /api/auth/personas", () => {
  it("lists the demo personas with AUTH_PROVIDER=mock", async () => {
    const { app } = await make()
    const res = await app.inject({ url: "/api/auth/personas" })
    expect(res.json().personas).toEqual([
      { username: "sam.scrum", displayName: "Sam Rivers", title: "Scrum Master" },
      { username: "morgan.manager", displayName: "Morgan Lee", title: "Manager" },
      { username: "ada.admin", displayName: "Ada Park", title: "Admin" },
    ])
  })
})

describe("with AUTH_PROVIDER=crowd (mock Crowd server)", () => {
  it("signs in with a username and password, maps Crowd groups to roles, and has no personas", async () => {
    const crowd = await startMockCrowd({
      app: { name: "jira-dashboard", password: "app-placeholder" },
      users: { "jo.dev": { password: "pw-jo", displayName: "Jo Developer", email: "jo@example.com", groups: ["eng", "jira-dashboard-authors"] } },
    })
    try {
      const { app } = await make({
        env: { AUTH_PROVIDER: "crowd", CROWD_URL: crowd.url, CROWD_APP_NAME: "jira-dashboard", CROWD_APP_PASSWORD: "app-placeholder" },
        provider: (env) => createCrowdAuthProvider(env),
      })
      expect((await app.inject({ url: "/api/config" })).json().authProvider).toBe("crowd")
      expect((await app.inject({ url: "/api/auth/personas" })).statusCode).toBe(404)
      expect((await login(app, "jo.dev", "wrong")).statusCode).toBe(401)
      const ok = await login(app, "jo.dev", "pw-jo")
      expect(ok.json()).toEqual({ user: { id: "jo.dev", displayName: "Jo Developer", email: "jo@example.com" }, roles: ["author", "viewer"] })
      expect(crowd.sessions.size).toBe(1)
      const cookie = String(ok.headers["set-cookie"]).split(";")[0]
      await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } })
      expect(crowd.sessions.size).toBe(0)
    } finally {
      await crowd.close()
    }
  })
})
