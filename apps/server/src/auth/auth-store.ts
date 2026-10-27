/**
 * Where sessions and the user cache live: MongoDB in the server, memory in tests.
 */
import type { Db } from "mongodb"
import { collections, type SessionDoc, type UserDoc } from "../db"
import type { AuthUser } from "./provider"

export interface AuthStore {
  createSession(session: SessionDoc): Promise<void>
  getSession(id: string): Promise<SessionDoc | null>
  updateSession(id: string, patch: Partial<Pick<SessionDoc, "roles" | "lastValidatedAt">>): Promise<void>
  deleteSession(id: string): Promise<void>
  upsertUser(user: AuthUser, at: Date): Promise<void>
  getUser(id: string): Promise<UserDoc | null>
}

export function createMongoAuthStore(db: Db): AuthStore {
  const { sessions, users } = collections(db)
  return {
    async createSession(session) {
      await sessions.insertOne(session)
    },
    getSession: (id) => sessions.findOne({ _id: id }),
    async updateSession(id, patch) {
      await sessions.updateOne({ _id: id }, { $set: patch })
    },
    async deleteSession(id) {
      await sessions.deleteOne({ _id: id })
    },
    async upsertUser(user, at) {
      await users.updateOne(
        { _id: user.id },
        { $set: { displayName: user.displayName, email: user.email, groups: user.groups, lastSeenAt: at } },
        { upsert: true },
      )
    },
    getUser: (id) => users.findOne({ _id: id }),
  }
}

export function createMemoryAuthStore(): AuthStore & { sessions: Map<string, SessionDoc>; users: Map<string, UserDoc> } {
  const sessions = new Map<string, SessionDoc>()
  const users = new Map<string, UserDoc>()
  return {
    sessions,
    users,
    async createSession(session) {
      sessions.set(session._id, { ...session })
    },
    async getSession(id) {
      const s = sessions.get(id)
      return s ? { ...s } : null
    },
    async updateSession(id, patch) {
      const s = sessions.get(id)
      if (s) sessions.set(id, { ...s, ...patch })
    },
    async deleteSession(id) {
      sessions.delete(id)
    },
    async upsertUser(user, at) {
      users.set(user.id, { _id: user.id, displayName: user.displayName, email: user.email, groups: user.groups, lastSeenAt: at })
    },
    async getUser(id) {
      return users.get(id) ?? null
    },
  }
}
