import type { Env } from "../env"

/** Capabilities, not ranks: authors create and share reports; admins also publish data and run jobs. */
export type Role = "viewer" | "author" | "admin"

/** Roles from provider groups, per ROLE_GROUPS_ADMIN / ROLE_GROUPS_AUTHOR. Anyone who can sign in is a viewer. */
export function rolesFor(groups: string[], env: Pick<Env, "ROLE_GROUPS_ADMIN" | "ROLE_GROUPS_AUTHOR">): Role[] {
  const has = (wanted: string[]) => groups.some((g) => wanted.includes(g))
  if (has(env.ROLE_GROUPS_ADMIN)) return ["admin", "author", "viewer"]
  if (has(env.ROLE_GROUPS_AUTHOR)) return ["author", "viewer"]
  return ["viewer"]
}
