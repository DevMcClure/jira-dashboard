/**
 * The HTTP API. Every route sits under `${BASE_PATH}/api`; CORS allows only
 * CORS_ORIGIN. Built from an env object and a store, so tests run it in memory.
 */
import cors from "@fastify/cors"
import Fastify from "fastify"
import type { DatasetStore } from "./dataset-store"
import type { Env } from "./env"

type Options = {
  env: Pick<Env, "BASE_PATH" | "CORS_ORIGIN" | "LOG_LEVEL">
  store: DatasetStore
  version: string
  /** Turn request logging off in tests. */
  logger?: boolean
}

/** What this server can do; later phases switch these on. The web app reads it to show or hide features. */
const FEATURES = { auth: false, ingest: false, snapshots: false, sharedReports: false }

export async function buildApp({ env, store, version, logger = true }: Options) {
  const app = Fastify({ logger: logger ? { level: env.LOG_LEVEL } : false })
  const startedAt = Date.now()

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    exposedHeaders: ["ETag", "X-Ingest-Id"],
  })

  await app.register(
    async (api) => {
      api.get("/health", async (_req, reply) => {
        const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000)
        try {
          await store.ping()
          return { status: "ok", db: "ok", version, uptimeSeconds }
        } catch {
          return reply.code(503).send({ status: "degraded", db: "down", version, uptimeSeconds })
        }
      })

      api.get("/config", async () => ({ mode: "api", version, features: FEATURES }))

      api.get("/dataset", async (req, reply) => {
        const current = await store.current()
        if (!current) {
          return reply.code(404).send({ error: "No data yet. Send a Trawler export to the server, or start it with SEED_MOCK=true." })
        }
        const etag = `"${current.ingest.id}"`
        reply.header("ETag", etag).header("X-Ingest-Id", current.ingest.id).header("Cache-Control", "no-cache")
        if (req.headers["if-none-match"] === etag) return reply.code(304).send()
        return reply.type("application/json; charset=utf-8").send(current.json)
      })
    },
    { prefix: `${env.BASE_PATH}/api` },
  )

  return app
}
