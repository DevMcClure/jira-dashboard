/**
 * Starts the API: validate env, connect to MongoDB, create indexes, seed if
 * asked, listen. Every setting comes from the environment (see .env.example).
 */
import pkg from "../package.json" with { type: "json" }
import { buildApp } from "./app"
import { createMongoAuthStore } from "./auth/auth-store"
import { createCrowdAuthProvider } from "./auth/crowd-provider"
import { createMockAuthProvider } from "./auth/mock-provider"
import { createOidcAuthProvider } from "./auth/oidc-provider"
import type { AuthProvider } from "./auth/provider"
import { createMongoDatasetStore } from "./dataset-store"
import { connect, ensureIndexes } from "./db"
import { EnvError, envWarnings, loadEnv, type Env } from "./env"
import { createPuller, pullSourceLabel, schedulePull } from "./ingest/pull"
import { scheduleSnapshots } from "./snapshots/schedule"
import { createMongoSnapshotStore } from "./snapshots/store"
import { seedIfEmpty } from "./seed"

function providerFor(env: Env): AuthProvider {
  switch (env.AUTH_PROVIDER) {
    case "crowd":
      return createCrowdAuthProvider(env)
    case "oidc":
      return createOidcAuthProvider()
    case "mock":
      return createMockAuthProvider(env)
  }
}

async function main() {
  let env
  try {
    env = loadEnv(process.env)
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }
  // Days start and end in the teams' time zone (SNAPSHOT_TZ), for core's date maths as in the browser.
  process.env.TZ = env.SNAPSHOT_TZ

  let mongo
  try {
    mongo = await connect(env)
  } catch (err) {
    console.error(`Couldn't connect to MongoDB (MONGO_URI, MONGO_DB_NAME, MONGO_TLS_CA_FILE): ${(err as Error).message}`)
    process.exit(1)
  }
  await ensureIndexes(mongo.db)
  const store = createMongoDatasetStore(mongo.db)

  const app = await buildApp({
    env,
    store,
    auth: { provider: providerFor(env), store: createMongoAuthStore(mongo.db) },
    snapshots: createMongoSnapshotStore(mongo.db),
    version: pkg.version,
  })
  for (const warning of envWarnings(env)) app.log.warn(warning)
  app.log.info(`Sign-in: ${env.AUTH_PROVIDER}`)
  if (env.SEED_MOCK) {
    const seeded = await seedIfEmpty(store)
    app.log.info(seeded ? `Seeded the mock dataset (ingest ${seeded.id})` : "Data already present; not seeding")
  }

  app.log.info(env.INGEST_TOKEN ? "Push ingest: on (POST /api/ingest)" : "Push ingest: off (INGEST_TOKEN not set)")

  let pullJob: ReturnType<typeof schedulePull> | null = null
  const snapshotJob = scheduleSnapshots(env, app.snapshotJob, app.log)
  app.log.info(
    snapshotJob
      ? `Snapshots: "${env.SNAPSHOT_CRON}" in ${env.SNAPSHOT_TZ} (next ${snapshotJob.nextRun()?.toISOString()})`
      : "Snapshots: schedule off (SNAPSHOT_CRON=off)",
  )
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`)
    pullJob?.stop()
    snapshotJob?.stop()
    await app.close()
    await mongo.client.close()
    process.exit(0)
  }
  process.once("SIGINT", () => void shutdown("SIGINT"))
  process.once("SIGTERM", () => void shutdown("SIGTERM"))

  await app.listen({ host: env.HOST, port: env.PORT })

  // Optional pull, once listening (env.ts has checked the settings belong together).
  if (env.TRAWLER_PULL_CRON) {
    pullJob = schedulePull(env.TRAWLER_PULL_CRON, createPuller({ pipeline: app.ingest, env, log: app.log }).run)
    app.log.info(`Pull: ${pullSourceLabel(env)} on "${env.TRAWLER_PULL_CRON}" (next ${pullJob.nextRun()?.toISOString()})`)
  }
}

await main()
