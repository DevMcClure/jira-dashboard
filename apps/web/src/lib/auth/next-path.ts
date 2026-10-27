/**
 * Where to go after signing in. Only paths inside this app (under Vite's base)
 * are allowed, so `?next=` can't send anyone to another site.
 */
export function safeNext(next: string | null, base: string): string {
  if (!next || !next.startsWith(base) || next.startsWith("//") || next.includes("\\")) return base
  // Never back to the sign-in page itself.
  if (new URL(next, "http://app").pathname === loginPath(base)) return base
  return next
}

export const loginPath = (base: string) => `${base}login`

/** The sign-in URL that returns to `current` afterwards. */
export function loginUrl(current: string, base: string): string {
  const next = safeNext(current, base)
  return next === base ? loginPath(base) : `${loginPath(base)}?next=${encodeURIComponent(next)}`
}
