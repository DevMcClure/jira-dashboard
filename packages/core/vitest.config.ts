import { defineConfig } from "vitest/config"

// Day bucketing uses local time; pin it so tests are deterministic everywhere.
process.env.TZ = "UTC"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
