/**
 * Atlassian Crowd, through its REST usermanagement API
 * (`<CROWD_URL>/rest/usermanagement/1`). The app authenticates to Crowd with
 * its application name and password (Basic auth) on every call; users sign in
 * with their username and password, which Crowd turns into an SSO token.
 */
import type { Env } from "../env"
import { InvalidCredentials, ProviderUnavailable, type AuthProvider } from "./provider"

type Options = Pick<Env, "CROWD_URL" | "CROWD_APP_NAME" | "CROWD_APP_PASSWORD"> & {
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

/** Crowd's reasons for a refused sign-in; all shown to the user as the same generic message. */
const REFUSED = new Set(["INVALID_USER_AUTHENTICATION", "USER_NOT_FOUND", "INACTIVE_ACCOUNT", "EXPIRED_CREDENTIAL", "INVALID_CREDENTIAL"])

export function createCrowdAuthProvider({ CROWD_URL, CROWD_APP_NAME, CROWD_APP_PASSWORD, fetch = globalThis.fetch, timeoutMs = 10_000 }: Options): AuthProvider {
  if (!CROWD_URL || !CROWD_APP_NAME || !CROWD_APP_PASSWORD) throw new Error("Crowd settings are incomplete")
  const base = `${CROWD_URL.replace(/\/+$/, "")}/rest/usermanagement/1`
  const authorization = `Basic ${Buffer.from(`${CROWD_APP_NAME}:${CROWD_APP_PASSWORD}`).toString("base64")}`

  const host = new URL(base).host

  // These messages go to the server log only (users see a generic 503), and never include tokens or passwords.
  const call = async (method: string, path: string, body?: unknown) => {
    try {
      return await fetch(`${base}${path}`, {
        method,
        headers: { authorization, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      const cause = (err as { cause?: { code?: string; message?: string } }).cause
      const reason =
        err instanceof DOMException && err.name === "TimeoutError"
          ? `no answer within ${timeoutMs} ms`
          : cause?.code || cause?.message || (err as Error).message || "network error"
      throw new ProviderUnavailable(`Couldn't reach Crowd at ${host} (${reason}).`)
    }
  }
  const unexpected = (res: Response, what: string) => new ProviderUnavailable(`Crowd answered ${res.status} to the ${what}.`)
  const reasonOf = async (res: Response) => {
    try {
      return ((await res.json()) as { reason?: string }).reason ?? ""
    } catch {
      return ""
    }
  }
  const q = encodeURIComponent

  const groupsFor = async (username: string) => {
    const res = await call("GET", `/user/group/nested?username=${q(username)}&max-results=1000`)
    if (!res.ok) throw unexpected(res, "group lookup")
    const data = (await res.json()) as { groups?: { name: string }[] }
    return (data.groups ?? []).map((g) => g.name)
  }

  return {
    kind: "crowd",

    async login(username, password) {
      const res = await call("POST", "/session", {
        username,
        password,
        "validation-factors": { validationFactors: [] },
      })
      // 400 + a refusal reason = the user's credentials. 401/403 = Crowd refused *our* app
      // credentials (CROWD_APP_NAME / CROWD_APP_PASSWORD): a configuration problem, not the user's.
      if (res.status === 400 && REFUSED.has(await reasonOf(res))) throw new InvalidCredentials()
      if (res.status === 401 || res.status === 403) throw new ProviderUnavailable("Crowd refused the application's credentials (check CROWD_APP_NAME / CROWD_APP_PASSWORD).")
      if (!res.ok) throw unexpected(res, "sign-in")
      const session = (await res.json()) as { token: string; user?: { name?: string } }
      const name = session.user?.name ?? username

      const userRes = await call("GET", `/user?username=${q(name)}`)
      if (!userRes.ok) throw unexpected(userRes, "user lookup")
      const details = (await userRes.json()) as { name: string; "display-name"?: string; email?: string }

      return {
        user: { id: details.name, displayName: details["display-name"] || details.name, email: details.email || null, groups: await groupsFor(details.name) },
        token: session.token,
      }
    },

    async validate({ token }) {
      if (!token) return false
      const res = await call("POST", `/session/${q(token)}`, { validationFactors: [] })
      if (res.ok) return true
      if (res.status === 400 || res.status === 404) return false
      throw unexpected(res, "session check")
    },

    async logout({ token }) {
      if (!token) return
      const res = await call("DELETE", `/session/${q(token)}`)
      // Already gone is fine; anything else is Crowd's problem, not the user's.
      if (!res.ok && res.status !== 404) throw unexpected(res, "sign-out")
    },

    groupsFor,
  }
}
