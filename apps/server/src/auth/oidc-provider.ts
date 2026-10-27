import { NotImplementedProvider, type AuthProvider } from "./provider"

const TODO =
  "OIDC sign-in isn't implemented. If an SSO provider (SAML/OIDC) sits in front of Crowd, implement it in apps/server/src/auth/oidc-provider.ts."

/**
 * Placeholder for an OIDC identity provider in front of Crowd.
 * TODO, if needed:
 * - env: OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_PATH
 * - routes: GET /auth/oidc/start (redirect with state + PKCE), GET /auth/oidc/callback (exchange code, read the ID token)
 * - map the ID token's groups claim through rolesFor(), then create our session exactly as login does today
 */
export function createOidcAuthProvider(): AuthProvider {
  const fail = async (): Promise<never> => {
    throw new NotImplementedProvider(TODO)
  }
  return { kind: "oidc", login: fail, validate: fail, logout: fail, groupsFor: fail }
}
