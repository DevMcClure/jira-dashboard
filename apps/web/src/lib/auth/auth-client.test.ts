import { describe, expect, it, vi } from "vitest"
import { AuthRequestError, authEvents, createAuthClient, notifyUnauthorized, UNAUTHORIZED_EVENT } from "./auth-client"
import { loginUrl, safeNext } from "./next-path"
import { initials, roleLabel } from "./roles"

const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })
const stub = (...responses: Response[]) => {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const r of responses) fetch.mockResolvedValueOnce(r)
  return fetch
}
const session = { user: { id: "sam.scrum", displayName: "Sam Rivers", email: null }, roles: ["author", "viewer"] }

describe("createAuthClient", () => {
  it("signs in with the session cookie, never a token", async () => {
    const fetch = stub(json(200, session))
    const client = createAuthClient({ baseUrl: "/api", fetch })
    expect(await client.login("sam.scrum", "pw")).toEqual(session)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe("/api/auth/login")
    expect(init).toMatchObject({ method: "POST", credentials: "include", body: JSON.stringify({ username: "sam.scrum", password: "pw" }) })
    expect(JSON.stringify(init?.headers)).not.toMatch(/authorization/i)
  })

  it("shows the server's message for a refused sign-in, and a friendly one when rate-limited", async () => {
    const client = createAuthClient({ baseUrl: "/api", fetch: stub(json(401, { error: "That username and password didn't work." }), json(429, { message: "Rate limit exceeded" })) })
    await expect(client.login("x")).rejects.toMatchObject({ status: 401, message: "That username and password didn't work." })
    await expect(client.login("x")).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/Wait a minute/) })
  })

  it("me() is null without a session", async () => {
    const client = createAuthClient({ baseUrl: "/api", fetch: stub(json(401, { error: "Sign in to continue." }), json(200, session)) })
    expect(await client.me()).toBeNull()
    expect(await client.me()).toEqual(session)
  })

  it("lists personas only when the server offers them", async () => {
    const personas = [{ username: "sam.scrum", displayName: "Sam Rivers", title: "Scrum Master" }]
    const client = createAuthClient({ baseUrl: "/api", fetch: stub(json(200, { personas }), json(404, { error: "no" })) })
    expect(await client.personas()).toEqual(personas)
    expect(await client.personas()).toEqual([])
  })

  it("explains an unreachable server", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError("fetch failed")
    })
    const err = await createAuthClient({ baseUrl: "https://x.example/api", fetch }).getConfig().catch((e) => e)
    expect(err).toBeInstanceOf(AuthRequestError)
    expect(err.message).toMatch(/Couldn't reach the dashboard server at https:\/\/x\.example\/api/)
  })

  it("logs out with a POST", async () => {
    const fetch = stub(new Response(null, { status: 204 }))
    await createAuthClient({ baseUrl: "/dash/api", fetch }).logout()
    expect(fetch).toHaveBeenCalledWith("/dash/api/auth/logout", expect.objectContaining({ method: "POST", credentials: "include" }))
  })
})

describe("notifyUnauthorized", () => {
  it("raises the unauthorized event", () => {
    const heard = vi.fn()
    authEvents.addEventListener(UNAUTHORIZED_EVENT, heard)
    notifyUnauthorized()
    authEvents.removeEventListener(UNAUTHORIZED_EVENT, heard)
    expect(heard).toHaveBeenCalledTimes(1)
  })
})

describe("roleLabel and initials", () => {
  it("names the highest role", () => {
    expect(roleLabel(["admin", "author", "viewer"])).toBe("Admin")
    expect(roleLabel(["author", "viewer"])).toBe("Author")
    expect(roleLabel(["viewer"])).toBe("Viewer")
  })
  it("makes avatar initials from a name or a username", () => {
    expect(initials("Sam Rivers")).toBe("SR")
    expect(initials("Mary Ann de Vries")).toBe("MV")
    expect(initials("sam.scrum")).toBe("SS")
    expect(initials("ada")).toBe("AD")
  })
})

describe("safeNext / loginUrl", () => {
  it("returns only to paths inside the app", () => {
    expect(safeNext("/flow?team=PLAT", "/")).toBe("/flow?team=PLAT")
    expect(safeNext("/dash/people", "/dash/")).toBe("/dash/people")
    expect(safeNext("//evil.example/x", "/")).toBe("/")
    expect(safeNext("https://evil.example/", "/")).toBe("/")
    expect(safeNext("/\\evil.example", "/")).toBe("/")
    expect(safeNext("/other-app/", "/dash/")).toBe("/dash/")
    expect(safeNext("/login?next=/x", "/")).toBe("/")
    expect(safeNext(null, "/")).toBe("/")
  })
  it("builds the sign-in URL", () => {
    expect(loginUrl("/", "/")).toBe("/login")
    expect(loginUrl("/flow?team=PLAT", "/")).toBe("/login?next=%2Fflow%3Fteam%3DPLAT")
    expect(loginUrl("/dash/pi", "/dash/")).toBe("/dash/login?next=%2Fdash%2Fpi")
  })
})
