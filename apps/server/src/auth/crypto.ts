/**
 * Session ids, and encryption for the provider token we keep server-side
 * (AES-256-GCM, key derived from SESSION_SECRET), so a database dump doesn't
 * hand out live Crowd sessions.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

export function newSessionId(): string {
  return randomBytes(32).toString("base64url")
}

export type TokenCipher = { encrypt(plain: string): string; decrypt(sealed: string): string }

export function createTokenCipher(secret: string): TokenCipher {
  const key = scryptSync(secret, "jira-dashboard/provider-token/v1", 32)
  return {
    encrypt(plain) {
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, iv)
      const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
      return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`
    },
    decrypt(sealed) {
      if (!sealed.startsWith("v1.")) throw new Error("Unknown token format")
      const raw = Buffer.from(sealed.slice(3), "base64url")
      const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12))
      decipher.setAuthTag(raw.subarray(12, 28))
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")
    },
  }
}
