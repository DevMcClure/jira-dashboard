// Bundles the server into dist/index.js: our code, @jira-dashboard/core and the
// sample data are inlined; npm dependencies stay external (installed alongside).
import { readFileSync } from "node:fs"
import { build } from "esbuild"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
const external = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith("@jira-dashboard/"))

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "info",
})
