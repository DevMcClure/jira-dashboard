/**
 * The flow metric settings: everyone signed in reads them (the web app's flow
 * numbers use them); admins change or reset them. docs/decisions/0043.
 */
import { DEFAULT_FLOW_CONFIG, flowConfigProblems, parseFlowConfig } from "@jira-dashboard/core/flowConfig"
import type { FastifyInstance } from "fastify"
import type { Guard } from "../auth/routes"
import type { SettingsStore } from "./store"

type Deps = {
  store: SettingsStore
  signedIn: Guard
  adminOnly: Guard[]
  displayNameOf: (userId: string) => Promise<string>
  now?: () => Date
}

export async function settingsRoutes(api: FastifyInstance, { store, signedIn, adminOnly, displayNameOf, now = () => new Date() }: Deps) {
  const current = async () => {
    const saved = await store.getFlow()
    if (!saved) return { config: DEFAULT_FLOW_CONFIG, isDefault: true, updatedAt: null, updatedBy: null }
    return {
      config: saved.config,
      isDefault: false,
      updatedAt: saved.updatedAt.toISOString(),
      updatedBy: { id: saved.updatedBy, displayName: await displayNameOf(saved.updatedBy) },
    }
  }

  api.get("/settings/flow", { preHandler: signedIn }, async () => current())

  api.put("/settings/flow", { onRequest: adminOnly }, async (request, reply) => {
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) return reply.code(415).send({ error: "Send JSON: { config }." })
    const raw = (request.body as { config?: unknown } | undefined)?.config
    const config = parseFlowConfig(raw)
    if (!config) return reply.code(400).send({ error: "Those settings aren't valid.", problems: flowConfigProblems(raw).slice(0, 20) })
    await store.setFlow(config, request.auth!.user.id, now())
    return current()
  })

  api.delete("/settings/flow", { onRequest: adminOnly }, async () => {
    await store.clearFlow()
    return current()
  })
}
