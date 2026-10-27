import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { authEvents, createAuthClient, UNAUTHORIZED_EVENT, type AuthClient } from "@/lib/auth/auth-client"
import { loginPath, loginUrl, safeNext } from "@/lib/auth/next-path"
import { API_BASE_URL, DATA_MODE } from "@/lib/data/data-mode"
import { AuthContext, type AuthState } from "./auth-context"

const defaultClient = createAuthClient({ baseUrl: API_BASE_URL })
const BASE = import.meta.env.BASE_URL

/*
 * The router mounts only once someone is signed in, so the address bar is
 * set here, before it reads it: /login?next=… while signed out, then back.
 */
const here = () => window.location.pathname + window.location.search + window.location.hash
const showLoginUrl = () => {
  if (window.location.pathname !== loginPath(BASE)) window.history.replaceState(null, "", loginUrl(here(), BASE))
}
const leaveLoginUrl = () => {
  if (window.location.pathname === loginPath(BASE)) {
    window.history.replaceState(null, "", safeNext(new URLSearchParams(window.location.search).get("next"), BASE))
  }
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

type Props = {
  children: ReactNode
  client?: AuthClient
  /** Sign-in only exists in api mode. */
  enabled?: boolean
}

/** Who's signed in (api mode). In the static build it's always "disabled" and never calls the server. */
export function AuthProvider({ children, client = defaultClient, enabled = DATA_MODE === "api" }: Props) {
  const [state, setState] = useState<AuthState>(enabled ? { status: "loading" } : { status: "disabled" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const boot = async (): Promise<AuthState> => {
      const config = await client.getConfig()
      if (!config.features.auth) return { status: "disabled" }
      const session = await client.me()
      return session ? { status: "signedIn", config, ...session } : { status: "anonymous", config, notice: null }
    }
    boot().then(
      (next) => {
        if (cancelled) return
        if (next.status === "anonymous") showLoginUrl()
        else leaveLoginUrl()
        setState(next)
      },
      (err) => !cancelled && setState({ status: "error", message: messageOf(err) }),
    )
    return () => {
      cancelled = true
    }
  }, [client, enabled, attempt])

  // Any API call that gets a 401 ends the session here too.
  useEffect(() => {
    if (!enabled) return
    const onUnauthorized = () =>
      setState((s) => {
        if (s.status !== "signedIn") return s
        showLoginUrl()
        return { status: "anonymous", config: s.config, notice: "Your session has ended. Sign in again." }
      })
    authEvents.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => authEvents.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [enabled])

  const signIn = useCallback(
    async (username: string, password = "") => {
      const session = await client.login(username, password)
      leaveLoginUrl()
      setState((s) => (s.status === "anonymous" ? { status: "signedIn", config: s.config, ...session } : s))
    },
    [client],
  )

  const signOut = useCallback(async () => {
    await client.logout()
    showLoginUrl()
    setState((s) => (s.status === "signedIn" ? { status: "anonymous", config: s.config, notice: "You've signed out." } : s))
  }, [client])

  const retry = useCallback(() => {
    setState({ status: "loading" })
    setAttempt((n) => n + 1)
  }, [])

  const value = useMemo(() => ({ state, signIn, signOut, personas: client.personas, retry }), [state, signIn, signOut, client, retry])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
