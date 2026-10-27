/**
 * The HTTP API. Every route sits under `${BASE_PATH}/api`; CORS allows only
 * CORS_ORIGIN. Built from env, a dataset store and auth dependencies, so tests
 * run it in memory.
 */
import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import Fastify from "fastify"
import type { AuthStore } from "./auth/auth-store"
import { createTokenCipher } from "./auth/crypto"
import type { AuthProvider } from "./auth/provider"
import { authRoutes, requireRole, sessionGuard } from "./auth/routes"
import { createAuthService } from "./auth/service"
import type { DatasetStore } from "./dataset-store"
import type { Env } from "./env"
import { createIngestPipeline, type IngestPipeline } from "./ingest/pipeline"
import { ingestRoutes } from "./ingest/routes"

declare module "fastify" {
  interface FastifyInstance {
    /** The ingest pipeline, also used by the scheduled pull (index.ts). */
    ingest: IngestPipeline
  }
}

type Options = {
  env: Env
  store: DatasetStore
  auth: { provider: AuthProvider; store: AuthStore; now?: () => Date }
  version: string
  /** Turn request logging off in tests. */
  logger?: boolean
}

export async function buildApp({ env, store, auth, version, logger = true }: Options) {
  const app = Fastify({ logger: logger ? { level: env.LOG_LEVEL } : false, trustProxy: env.TRUST_PROXY })
  const startedAt = Date.now()
  const service = createAuthService({
    provider: auth.provider,
    store: auth.store,
    cipher: createTokenCipher(env.SESSION_SECRET),
    env,
    now: auth.now,
  })
  const signedIn = sessionGuard(service)
  const pipeline = createIngestPipeline({ store, log: app.log })
  app.decorate("ingest", pipeline)

  app.decorateRequest("auth", null)
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    exposedHeaders: ["ETag", "X-Ingest-Id", "X-Ingest-Source"],
  })
  await app.register(cookie, { secret: env.SESSION_SECRET })
  // Only routes that opt in (sign-in) are limited.
  await app.register(rateLimit, { global: false })

  /** What this server can do; later phases switch more on. The web app reads it to show or hide features. */
  const features = { auth: true, ingest: true, snapshots: false, sharedReports: false }

  await app.register(
    async (api) => {
      // Public: monitoring, and what the sign-in page needs to know.
      api.get("/health", async (_req, reply) => {
        const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000)
        try {
          await store.ping()
          return { status: "ok", db: "ok", version, uptimeSeconds }
        } catch {
          return reply.code(503).send({ status: "degraded", db: "down", version, uptimeSeconds })
        }
      })

      api.get("/config", async () => ({ mode: "api", version, authProvider: env.AUTH_PROVIDER, features }))

      await authRoutes(api, { service, provider: auth.provider, env })
      await ingestRoutes(api, { pipeline, env, adminOnly: [signedIn, requireRole("admin")] })

      // Signed in only.
      api.get("/dataset", { preHandler: signedIn }, async (req, reply) => {
        const current = await store.current()
        if (!current) {
          return reply.code(404).send({ error: "No data yet. Send a Trawler export to the server, or start it with SEED_MOCK=true." })
        }
        const etag = `"${current.ingest.id}"`
        reply
          .header("ETag", etag)
          .header("X-Ingest-Id", current.ingest.id)
          .header("X-Ingest-Source", current.ingest.source)
          .header("Cache-Control", "private, no-cache")
        if (req.headers["if-none-match"] === etag) return reply.code(304).send()
        return reply.type("application/json; charset=utf-8").send(current.json)
      })

      // The current ingest without its data: what the web app polls to notice new data.
      api.get("/dataset/meta", { preHandler: signedIn }, async (_req, reply) => {
        const ingest = await store.meta()
        reply.header("Cache-Control", "no-store")
        if (!ingest) return reply.code(404).send({ error: "No data yet." })
        const { id, source, receivedAt, generatedAt, counts } = ingest
        return { ingestId: id, source, receivedAt, generatedAt, counts }
      })
    },
    { prefix: `${env.BASE_PATH}/api` },
  )

  return app
}
