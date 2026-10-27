import { createContext } from "react"
import type { CurrentUser, Persona, Role, ServerConfig } from "@/lib/auth/auth-client"

/**
 * - disabled: no sign-in (the static build, or a server with auth off)
 * - loading / error: asking the server who we are
 * - anonymous: show the sign-in page (`notice` explains why, e.g. a session ended)
 */
export type AuthState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "anonymous"; config: ServerConfig; notice: string | null }
  | { status: "signedIn"; config: ServerConfig; user: CurrentUser; roles: Role[] }

export type AuthContextValue = {
  state: AuthState
  /** Throws AuthRequestError with a message to show. */
  signIn: (username: string, password?: string) => Promise<void>
  /** Throws if the server couldn't end the session (you stay signed in). */
  signOut: () => Promise<void>
  personas: () => Promise<Persona[]>
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
