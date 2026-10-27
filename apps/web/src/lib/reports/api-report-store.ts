import { parseReportConfig, type ReportConfig } from "@jira-dashboard/core/report-config"
import { notifyUnauthorized } from "@/lib/auth/auth-client"
import { ReportStoreError, type ReportRecipients, type ReportStore, type StoredReport } from "./report-store"

type Options = { baseUrl: string; fetch?: typeof globalThis.fetch }

type RawReport = Omit<StoredReport<unknown>, "config"> & { config: unknown }

/**
 * Reports kept on the server (api mode, B5), behind the same `ReportStore`
 * seam as the browser store. The server checks access on every request;
 * every config it sends is validated again here.
 */
export function createApiReportStore({ baseUrl, fetch = globalThis.fetch }: Options): ReportStore<ReportConfig> {
  const call = async (path: string, init: RequestInit = {}) => {
    let res: Response
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: "include",
        headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
      })
    } catch {
      throw new ReportStoreError(0, `Couldn't reach the dashboard server at ${baseUrl}.`)
    }
    if (res.ok) return res
    if (res.status === 401) {
      notifyUnauthorized()
      throw new ReportStoreError(401, "Your session has ended. Sign in again.")
    }
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ReportStoreError(res.status, body?.error ?? `The server couldn't do that (${res.status}).`)
  }

  const toStored = (raw: RawReport): StoredReport<ReportConfig> | null => {
    const config = parseReportConfig(raw.config)
    return config ? { ...raw, config } : null
  }
  const one = async (res: Response) => {
    const report = toStored((await res.json()) as RawReport)
    if (!report) throw new ReportStoreError(500, "The server sent a report this app can't read.")
    return report
  }
  const many = async (res: Response) =>
    ((await res.json()) as { reports: RawReport[] }).reports.flatMap((r) => {
      const report = toStored(r)
      return report ? [report] : []
    })
  const patch = (id: string, body: object) => call(`/reports/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })

  return {
    list: async () => many(await call("/reports?box=mine")),
    listShared: async () => many(await call("/reports?box=shared")),

    async get(id) {
      try {
        return await one(await call(`/reports/${encodeURIComponent(id)}`))
      } catch (err) {
        if (err instanceof ReportStoreError && err.status === 404) return null
        throw err
      }
    },

    async save({ id, config }) {
      if (id) {
        try {
          return await one(await patch(id, { config }))
        } catch (err) {
          if (!(err instanceof ReportStoreError && err.status === 404)) throw err
        }
      }
      return one(await call("/reports", { method: "POST", body: JSON.stringify({ config }) }))
    },

    async remove(id) {
      try {
        await call(`/reports/${encodeURIComponent(id)}`, { method: "DELETE" })
      } catch (err) {
        if (!(err instanceof ReportStoreError && err.status === 404)) throw err
      }
    },

    share: async (id: string, recipients: ReportRecipients) => one(await patch(id, { recipients })),

    data: async (id: string) => (await call(`/reports/${encodeURIComponent(id)}/data`)).text(),
  }
}
