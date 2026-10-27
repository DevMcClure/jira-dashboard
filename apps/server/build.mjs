// Bundles the server into dist/index.js: our code, @jira-dashboard/core and the
// sample data are inlined; npm dependencies stay external (installed alongside).
import { readFileSync } from "node:fs"
import { build } from "esbuild"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
const external = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith("@jira-dashboard/"))

// dist/index.js is the server; dist/backfill.js the snapshot backfill command.
await build({
  entryPoints: { index: "src/index.ts", backfill: "src/snapshots/backfill-cli.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "info",
})
