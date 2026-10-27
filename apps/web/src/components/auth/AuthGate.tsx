import type { ReactNode } from "react"
import { AppLoading } from "@/components/common/AppLoading"
import { useAuth } from "@/hooks/useAuth"
import { AuthUnavailable } from "./AuthUnavailable"
import { LoginPage } from "./LoginPage"

/** Shows the app only to signed-in users (api mode); the static build passes straight through. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, retry } = useAuth()
  switch (state.status) {
    case "disabled":
    case "signedIn":
      return children
    case "loading":
      return <AppLoading state="loading" />
    case "error":
      return <AuthUnavailable message={state.message} onRetry={retry} />
    case "anonymous":
      return <LoginPage provider={state.config.authProvider} notice={state.notice} />
  }
}
