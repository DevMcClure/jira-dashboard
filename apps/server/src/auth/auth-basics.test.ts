import { describe, expect, it } from "vitest"
import { testEnv } from "../testkit"
import { createTokenCipher, newSessionId } from "./crypto"
import { createMockAuthProvider } from "./mock-provider"
import { InvalidCredentials } from "./provider"
import { rolesFor } from "./roles"

const env = testEnv({ ROLE_GROUPS_ADMIN: "ops, leads", ROLE_GROUPS_AUTHOR: "scrum-masters" })

describe("rolesFor", () => {
  it("maps provider groups to capabilities; anyone who can sign in is a viewer", () => {
    expect(rolesFor(["leads"], env)).toEqual(["admin", "author", "viewer"])
    expect(rolesFor(["scrum-masters", "other"], env)).toEqual(["author", "viewer"])
    expect(rolesFor(["other"], env)).toEqual(["viewer"])
    expect(rolesFor([], env)).toEqual(["viewer"])
  })
})

describe("token cipher", () => {
  const cipher = createTokenCipher(env.SESSION_SECRET)
  it("round-trips, with a fresh IV each time", () => {
    const a = cipher.encrypt("crowd-token-123")
    const b = cipher.encrypt("crowd-token-123")
    expect(a).not.toBe(b)
    expect(a).not.toContain("crowd-token-123")
    expect(cipher.decrypt(a)).toBe("crowd-token-123")
  })
  it("refuses a token sealed with another secret or tampered with", () => {
    const sealed = cipher.encrypt("x")
    expect(() => createTokenCipher("another-secret-another-secret-123456").decrypt(sealed)).toThrow()
    expect(() => cipher.decrypt(sealed.slice(0, -2) + "AA")).toThrow()
  })
  it("makes unguessable session ids", () => {
    expect(newSessionId()).toMatch(/^[\w-]{43}$/)
    expect(newSessionId()).not.toBe(newSessionId())
  })
})

describe("mock provider", () => {
  const provider = createMockAuthProvider(testEnv())
  it("offers three personas whose groups map to admin, author and viewer", async () => {
    expect(provider.personas!().map((p) => p.title)).toEqual(["Scrum Master", "Manager", "Admin"])
    const roles = async (u: string) => rolesFor((await provider.login(u, "")).user.groups, testEnv())
    expect(await roles("sam.scrum")).toEqual(["author", "viewer"])
    expect(await roles("morgan.manager")).toEqual(["viewer"])
    expect(await roles("ada.admin")).toEqual(["admin", "author", "viewer"])
  })
  it("rejects anyone else", async () => {
    await expect(provider.login("mallory", "")).rejects.toBeInstanceOf(InvalidCredentials)
  })
})
