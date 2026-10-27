import type { Role } from "./auth-client"

/** The one word shown under a user's name: their highest role. */
export function roleLabel(roles: readonly Role[]): string {
  if (roles.includes("admin")) return "Admin"
  if (roles.includes("author")) return "Author"
  return "Viewer"
}

/** Up to two initials for an avatar ("Sam Rivers" → "SR", "sam.scrum" → "SS"). */
export function initials(name: string): string {
  const parts = name.split(/[\s._-]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase()
}
