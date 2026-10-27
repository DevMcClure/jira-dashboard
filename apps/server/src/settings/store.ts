/**
 * Shared settings: MongoDB in the server, memory in tests. So far only the
 * flow metric settings (absent until an admin saves some: then the defaults apply).
 */
import type { FlowConfig } from "@jira-dashboard/core/flowConfig"
import type { Db } from "mongodb"
import { collections } from "../db"

export type SavedFlowSettings = { config: FlowConfig; updatedAt: Date; updatedBy: string }

export interface SettingsStore {
  getFlow(): Promise<SavedFlowSettings | null>
  setFlow(config: FlowConfig, updatedBy: string, at: Date): Promise<void>
  /** Back to the defaults. */
  clearFlow(): Promise<void>
}

export function createMongoSettingsStore(db: Db): SettingsStore {
  const { settings } = collections(db)
  return {
    async getFlow() {
      const doc = await settings.findOne({ _id: "flow" })
      return doc ? { config: doc.config, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy } : null
    },
    async setFlow(config, updatedBy, at) {
      await settings.replaceOne({ _id: "flow" }, { config, updatedAt: at, updatedBy }, { upsert: true })
    },
    async clearFlow() {
      await settings.deleteOne({ _id: "flow" })
    },
  }
}

export function createMemorySettingsStore(): SettingsStore {
  let flow: SavedFlowSettings | null = null
  return {
    getFlow: async () => (flow ? structuredClone(flow) : null),
    async setFlow(config, updatedBy, at) {
      flow = structuredClone({ config, updatedAt: at, updatedBy })
    },
    async clearFlow() {
      flow = null
    },
  }
}
