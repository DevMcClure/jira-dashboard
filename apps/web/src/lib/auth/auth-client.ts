/**
 * The server's sign-in API (api mode only). The browser never sees a token:
 * the server sets an httpOnly session cookie, so every call sends
 * `credentials: "include"` and nothing else.
 */

export type Role = "viewer" | "author" | "admin"
export type CurrentUser = { id: string; displayName: string; email: string | null }
export type Session = { user: CurrentUser; roles: Role[] }
export type Persona = { username: string; displayName: string; title: string }

/** What GET /config says about the server. */
export type ServerConfig = {
  mode: "api"
  version: string
  authProvider: "mock" | "crowd" | "oidc"
  features: { auth: boolean; ingest: boolean; snapshots: boolean; sharedReports: boolean }
}

/** Raised (on `authEvents`) when an API call finds the session gone, so the app can show sign-in. */
export const UNAUTHORIZED_EVENT = "jira-dashboard:unauthorized"
export const authEvents = new EventTarget()
export const notifyUnauthorized = () => authEvents.dispatchEvent(new Event(UNAUTHORIZED_EVENT))

/** A refused or failed call; `message` is safe to show. */
export class AuthRequestError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "AuthRequestError"
    this.status = status
  }
}

type Options = { baseUrl: string; fetch?: typeof globalThis.fetch }

export function createAuthClient({ baseUrl, fetch = globalThis.fetch }: Options) {
  const call = async (path: string, init: RequestInit = {}) => {
    try {
      return await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: "include",
        headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
      })
    } catch {
      throw new AuthRequestError(0, `Couldn't reach the dashboard server at ${baseUrl}. Is it running?`)
    }
  }
  const errorFrom = async (res: Response, fallback: string) => {
    if (res.status === 429) return new AuthRequestError(429, "Too many sign-in attempts. Wait a minute and try again.")
    const body = await res.json().catch(() => null)
    const message = body && typeof body.error === "string" ? body.error : fallback
    return new AuthRequestError(res.status, message)
  }

  return {
    async getConfig(): Promise<ServerConfig> {
      const res = await call("/config")
      if (!res.ok) throw await errorFrom(res, `The server couldn't send its settings (${res.status}).`)
      return res.json()
    },

    /** The signed-in user, or null when there's no session. */
    async me(): Promise<Session | null> {
      const res = await call("/auth/me")
      if (res.status === 401) return null
      if (!res.ok) throw await errorFrom(res, `Couldn't check your sign-in (${res.status}).`)
      return res.json()
    },

    async login(username: string, password = ""): Promise<Session> {
      const res = await call("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) })
      if (!res.ok) throw await errorFrom(res, `Sign-in failed (${res.status}).`)
      return res.json()
    },

    async logout(): Promise<void> {
      const res = await call("/auth/logout", { method: "POST" })
      if (!res.ok) throw await errorFrom(res, `Sign-out failed (${res.status}).`)
    },

    /** Demo personas (AUTH_PROVIDER=mock); empty otherwise. */
    async personas(): Promise<Persona[]> {
      const res = await call("/auth/personas")
      if (res.status === 404) return []
      if (!res.ok) throw await errorFrom(res, `Couldn't list the demo users (${res.status}).`)
      return (await res.json()).personas
    },
  }
}

export type AuthClient = ReturnType<typeof createAuthClient>
