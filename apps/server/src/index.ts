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
    version: pkg.version,
  })
  for (const warning of envWarnings(env)) app.log.warn(warning)
  app.log.info(`Sign-in: ${env.AUTH_PROVIDER}`)
  if (env.SEED_MOCK) {
    const seeded = await seedIfEmpty(store)
    app.log.info(seeded ? `Seeded the mock dataset (ingest ${seeded.id})` : "Data already present; not seeding")
  }

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`)
    await app.close()
    await mongo.client.close()
    process.exit(0)
  }
  process.once("SIGINT", () => void shutdown("SIGINT"))
  process.once("SIGTERM", () => void shutdown("SIGTERM"))

  await app.listen({ host: env.HOST, port: env.PORT })
}

await main()
