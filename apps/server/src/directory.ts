/**
 * GET /directory/search?q=: people and groups to share a report with, from
 * the sign-in provider (Crowd in production, the personas in development).
 */
import type { FastifyInstance } from "fastify"
import { sendAuthError, type Guard } from "./auth/routes"
import type { AuthProvider } from "./auth/provider"

export async function directoryRoutes(api: FastifyInstance, { provider, signedIn }: { provider: AuthProvider; signedIn: Guard }) {
  api.get("/directory/search", { preHandler: signedIn }, async (request, reply) => {
    const q = String((request.query as { q?: unknown }).q ?? "").trim()
    if (q.length < 2 || q.length > 100) return reply.code(400).send({ error: "Type at least 2 characters." })
    try {
      return await provider.search(q)
    } catch (err) {
      return sendAuthError(err, reply, request)
    }
  })
}
