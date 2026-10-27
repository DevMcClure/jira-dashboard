/**
 * Which build this is, fixed at build time (docs/plan-backend.md):
 * "static" for the GitHub Pages demo (sample + uploads), "api" to read live
 * data from the server.
 */
export type DataMode = "static" | "api"

export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_MODE === "api" ? "api" : "static"

/** The server's API root, without a trailing slash. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "")
