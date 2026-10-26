/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "api" to read data from the server; anything else (or unset) is the static GitHub Pages build. */
  readonly VITE_DATA_MODE?: string
  /** Where the web app reaches the server's API (default "/api"). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
