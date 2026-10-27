import { defineConfig } from "vitest/config"

// Day bucketing in core uses local time; pin it so tests are deterministic everywhere.
process.env.TZ = "UTC"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Each test app seeds the 770 KB sample and derives keys with scrypt (~1–3 s unloaded),
    // so the 5 s default flakes when every package's tests run at once, or on CI runners.
    testTimeout: 20_000,
  },
})
