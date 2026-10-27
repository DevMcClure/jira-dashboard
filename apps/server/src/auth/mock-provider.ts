/**
 * Development sign-in: three personas, picked on the sign-in page with no
 * password. Their groups come from ROLE_GROUPS_*, so roles map exactly as
 * they would with Crowd. Never use in production (the server warns at startup).
 */
import type { Env } from "../env"
import { InvalidCredentials, type AuthProvider, type AuthUser, type Persona } from "./provider"

type Def = Persona & { email: string; groups: (env: Pick<Env, "ROLE_GROUPS_ADMIN" | "ROLE_GROUPS_AUTHOR">) => string[] }

const PERSONAS: Def[] = [
  { username: "sam.scrum", displayName: "Sam Rivers", title: "Scrum Master", email: "sam.rivers@example.com", groups: (e) => e.ROLE_GROUPS_AUTHOR.slice(0, 1) },
  { username: "morgan.manager", displayName: "Morgan Lee", title: "Manager", email: "morgan.lee@example.com", groups: () => [] },
  { username: "ada.admin", displayName: "Ada Park", title: "Admin", email: "ada.park@example.com", groups: (e) => e.ROLE_GROUPS_ADMIN.slice(0, 1) },
]

export function createMockAuthProvider(env: Pick<Env, "ROLE_GROUPS_ADMIN" | "ROLE_GROUPS_AUTHOR">): AuthProvider {
  const find = (username: string) => PERSONAS.find((p) => p.username === username)
  const toUser = (p: Def): AuthUser => ({ id: p.username, displayName: p.displayName, email: p.email, groups: p.groups(env) })
  return {
    kind: "mock",
    async login(username) {
      const persona = find(username.trim())
      if (!persona) throw new InvalidCredentials()
      return { user: toUser(persona), token: null }
    },
    async validate({ userId }) {
      return find(userId) !== undefined
    },
    async logout() {},
    async groupsFor(username) {
      const persona = find(username)
      return persona ? persona.groups(env) : []
    },
    personas: () => PERSONAS.map(({ username, displayName, title }) => ({ username, displayName, title })),
  }
}
