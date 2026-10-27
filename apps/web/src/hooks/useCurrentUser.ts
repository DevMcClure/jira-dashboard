import { useAuth } from "./useAuth"

/** The signed-in user and their roles, or null when there's no sign-in (static build) or nobody is signed in. */
export function useCurrentUser() {
  const { state, signOut } = useAuth()
  return state.status === "signedIn" ? { user: state.user, roles: state.roles, provider: state.config.authProvider, signOut } : null
}
