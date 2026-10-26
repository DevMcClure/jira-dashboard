/**
 * Every setting the server reads, validated at startup. All of them come from
 * the environment (a root .env in development); none are hard-coded. See
 * .env.example and docs/plan-backend.md → "Configuration template".
 */
import { z } from "zod"

const bool = z
  .enum(["true", "false", "1", "0", "yes", "no"], { message: "must be true or false" })
  .transform((v) => v === "true" || v === "1" || v === "yes")

const required = (name: string) => z.string({ message: `${name} is required` }).trim().min(1, `${name} is required`)

/** A URL path prefix: "/" or "/something" (no trailing slash). */
const basePath = z
  .string()
  .trim()
  .default("/")
  .refine((p) => p.startsWith("/"), { message: "must start with /" })
  .transform((p) => (p === "/" ? "" : p.replace(/\/+$/, "")))

const envSchema = z.object({
  HOST: required("HOST"),
  PORT: required("PORT")
    .transform(Number)
    .pipe(z.number({ message: "must be a number" }).int("must be a whole number").min(1, "must be 1–65535").max(65535, "must be 1–65535")),
  BASE_PATH: basePath,
  CORS_ORIGIN: required("CORS_ORIGIN").transform((s) =>
    s
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  MONGO_URI: required("MONGO_URI").refine((u) => /^mongodb(\+srv)?:\/\//.test(u), {
    message: "must start with mongodb:// or mongodb+srv://",
  }),
  MONGO_DB_NAME: required("MONGO_DB_NAME"),
  MONGO_TLS_CA_FILE: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  SEED_MOCK: bool.default(false),
})

export type Env = z.output<typeof envSchema>

export class EnvError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`The server can't start; fix these settings (see .env.example):\n${problems.map((p) => `  - ${p}`).join("\n")}`)
    this.name = "EnvError"
    this.problems = problems
  }
}

/** Typed settings from an environment object, or an EnvError listing every missing or invalid variable. */
export function loadEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings as unset, so `MONGO_TLS_CA_FILE=` in .env means "not used".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""))
  const result = envSchema.safeParse(cleaned)
  if (result.success) return result.data
  throw new EnvError(
    result.error.issues.map((i) => {
      const name = String(i.path[0] ?? "env")
      return i.message.startsWith(name) ? i.message : `${name}: ${i.message}`
    }),
  )
}
