/**
 * Sign-in, session checks and sign-out, independent of HTTP. Sessions live
 * server-side (AuthStore); the browser only holds a signed cookie with the id.
 */
import type { Env } from "../env"
import type { AuthStore } from "./auth-store"
import { newSessionId, type TokenCipher } from "./crypto"
import type { AuthProvider } from "./provider"
import { rolesFor, type Role } from "./roles"

export type AuthContext = {
  sessionId: string
  user: { id: string; displayName: string; email: string | null }
  roles: Role[]
}

type Deps = {
  provider: AuthProvider
  store: AuthStore
  cipher: TokenCipher
  env: Pick<Env, "SESSION_TTL_HOURS" | "CROWD_REVALIDATE_MINUTES" | "ROLE_GROUPS_ADMIN" | "ROLE_GROUPS_AUTHOR">
  now?: () => Date
}

const HOUR = 3_600_000
const MINUTE = 60_000

export function createAuthService({ provider, store, cipher, env, now = () => new Date() }: Deps) {
  const token = (sealed: string | null) => (sealed ? cipher.decrypt(sealed) : null)

  return {
    /** Check credentials with the provider and open a session. Throws InvalidCredentials / ProviderUnavailable. */
    async signIn(username: string, password: string) {
      const { user, token: providerToken } = await provider.login(username, password)
      const at = now()
      const roles = rolesFor(user.groups, env)
      const sessionId = newSessionId()
      const expiresAt = new Date(at.getTime() + env.SESSION_TTL_HOURS * HOUR)
      await store.upsertUser(user, at)
      await store.createSession({
        _id: sessionId,
        userId: user.id,
        roles,
        crowdToken: providerToken ? cipher.encrypt(providerToken) : null,
        expiresAt,
        lastValidatedAt: at,
        createdAt: at,
      })
      const auth: AuthContext = { sessionId, user: { id: user.id, displayName: user.displayName, email: user.email }, roles }
      return { auth, expiresAt }
    },

    /**
     * The signed-in user for a session id, or null if there's no live session.
     * Every CROWD_REVALIDATE_MINUTES it re-checks the provider's session and
     * refreshes groups (so role changes in Crowd take effect). If the provider
     * is unreachable it throws ProviderUnavailable and keeps the session.
     */
    async authenticate(sessionId: string): Promise<AuthContext | null> {
      const session = await store.getSession(sessionId)
      if (!session) return null
      const at = now()
      if (session.expiresAt <= at) {
        await store.deleteSession(sessionId)
        return null
      }
      let roles = session.roles
      if (at.getTime() - session.lastValidatedAt.getTime() >= env.CROWD_REVALIDATE_MINUTES * MINUTE) {
        const providerSession = { userId: session.userId, token: token(session.crowdToken) }
        if (!(await provider.validate(providerSession))) {
          await store.deleteSession(sessionId)
          return null
        }
        const groups = await provider.groupsFor(session.userId)
        roles = rolesFor(groups, env)
        await store.updateSession(sessionId, { roles, lastValidatedAt: at })
        const cached = await store.getUser(session.userId)
        if (cached) await store.upsertUser({ id: session.userId, displayName: cached.displayName, email: cached.email, groups }, at)
      }
      const user = await store.getUser(session.userId)
      return {
        sessionId,
        user: { id: session.userId, displayName: user?.displayName ?? session.userId, email: user?.email ?? null },
        roles,
      }
    },

    /** End the provider's session (best effort) and ours. */
    async signOut(sessionId: string) {
      const session = await store.getSession(sessionId)
      if (!session) return
      await store.deleteSession(sessionId)
      try {
        await provider.logout({ userId: session.userId, token: token(session.crowdToken) })
      } catch {
        // Our session is gone either way; the provider's will expire on its own.
      }
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
