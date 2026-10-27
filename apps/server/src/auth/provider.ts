/**
 * Who someone is, checked by an identity provider. The server only talks to
 * this interface: mock personas in development, Crowd in production, and an
 * OIDC placeholder for later (docs/plan-backend.md → B2).
 */

export type AuthUser = {
  /** The provider's username; also our user id. */
  id: string
  displayName: string
  email: string | null
  groups: string[]
}

/** What the provider needs to recognise an existing sign-in. */
export type ProviderSession = { userId: string; token: string | null }

export type Persona = { username: string; displayName: string; title: string }

export interface AuthProvider {
  readonly kind: "mock" | "crowd" | "oidc"
  /** Check credentials. Returns the user and the provider's own session token (if it has one). */
  login(username: string, password: string): Promise<{ user: AuthUser; token: string | null }>
  /** Is the provider's session still good? */
  validate(session: ProviderSession): Promise<boolean>
  logout(session: ProviderSession): Promise<void>
  groupsFor(username: string): Promise<string[]>
  /** Mock only: the personas offered on the sign-in page. */
  personas?(): Persona[]
}

/** Wrong username or password (or an inactive account). The message is safe to show. */
export class InvalidCredentials extends Error {
  constructor() {
    super("That username and password didn't work.")
    this.name = "InvalidCredentials"
  }
}

/** The provider couldn't be reached or answered unexpectedly. */
export class ProviderUnavailable extends Error {
  constructor(message = "Sign-in is unavailable right now. Try again shortly.") {
    super(message)
    this.name = "ProviderUnavailable"
  }
}

export class NotImplementedProvider extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotImplementedProvider"
  }
}
