/**
 * Sign-in routes and the session check other routes use. The browser holds a
 * signed, httpOnly, SameSite=Lax cookie with the session id; nothing else.
 */
// Type-only: brings in the request.cookies / reply.setCookie and route rateLimit typings.
import type {} from "@fastify/cookie"
import type {} from "@fastify/rate-limit"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import type { Env } from "../env"
import { InvalidCredentials, NotImplementedProvider, ProviderUnavailable, type AuthProvider } from "./provider"
import type { Role } from "./roles"
import type { AuthContext, AuthService } from "./service"

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null
  }
}

export const SESSION_COOKIE = "jd_session"
/** Sign-in attempts allowed per client per minute. */
export const LOGIN_ATTEMPTS_PER_MINUTE = 10

const loginBody = z.object({
  username: z.string().trim().min(1).max(200),
  password: z.string().max(1000).default(""),
})

type Deps = { service: AuthService; provider: AuthProvider; env: Pick<Env, "BASE_PATH" | "SESSION_TTL_HOURS"> }

function sendAuthError(err: unknown, reply: FastifyReply, request: FastifyRequest) {
  if (err instanceof InvalidCredentials) return reply.code(401).send({ error: err.message })
  if (err instanceof ProviderUnavailable) {
    request.log.warn({ err: err.message }, "identity provider unavailable")
    return reply.code(503).send({ error: "Sign-in is unavailable right now. Try again shortly." })
  }
  if (err instanceof NotImplementedProvider) return reply.code(501).send({ error: err.message })
  throw err
}

/** A route check; works as an onRequest or preHandler hook. */
export type Guard = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>

/** Reads the session cookie and attaches `request.auth`; 401 without a live session. */
export function sessionGuard(service: AuthService): Guard {
  return async (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE]
    const unsigned = raw ? request.unsignCookie(raw) : null
    if (!unsigned?.valid || !unsigned.value) return reply.code(401).send({ error: "Sign in to continue." })
    try {
      request.auth = await service.authenticate(unsigned.value)
    } catch (err) {
      return sendAuthError(err, reply, request)
    }
    if (!request.auth) return reply.code(401).send({ error: "Your session has ended. Sign in again." })
  }
}

/** For routes that need a capability, after sessionGuard. */
export function requireRole(role: Role): Guard {
  return async (request, reply) => {
    if (!request.auth?.roles.includes(role)) return reply.code(403).send({ error: `This needs the ${role} role.` })
  }
}

export async function authRoutes(api: FastifyInstance, { service, provider, env }: Deps) {
  const guard = sessionGuard(service)
  const cookieOptions = (request: FastifyRequest) => ({
    path: env.BASE_PATH || "/",
    httpOnly: true,
    sameSite: "lax" as const,
    signed: true,
    // HTTPS directly, or via a proxy when TRUST_PROXY=true.
    secure: request.protocol === "https",
  })

  api.post(
    "/auth/login",
    { config: { rateLimit: { max: LOGIN_ATTEMPTS_PER_MINUTE, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = loginBody.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: "Enter a username." })
      try {
        const { auth, expiresAt } = await service.signIn(body.data.username, body.data.password)
        reply.setCookie(SESSION_COOKIE, auth.sessionId, { ...cookieOptions(request), expires: expiresAt })
        return { user: auth.user, roles: auth.roles }
      } catch (err) {
        return sendAuthError(err, reply, request)
      }
    },
  )

  api.post("/auth/logout", async (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE]
    const unsigned = raw ? request.unsignCookie(raw) : null
    if (unsigned?.valid && unsigned.value) await service.signOut(unsigned.value)
    reply.clearCookie(SESSION_COOKIE, cookieOptions(request))
    return reply.code(204).send()
  })

  api.get("/auth/me", { preHandler: guard }, async (request) => ({ user: request.auth!.user, roles: request.auth!.roles }))

  api.get("/auth/personas", async (_request, reply) => {
    if (!provider.personas) return reply.code(404).send({ error: "Personas are only available with AUTH_PROVIDER=mock." })
    return { personas: provider.personas() }
  })
}
