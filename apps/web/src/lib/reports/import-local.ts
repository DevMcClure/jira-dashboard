import type { ReportStore } from "./report-store"

export type ImportResult = { imported: number; failed: { title: string; reason: string }[] }

/**
 * Move this browser's saved reports to the server: each one is created there
 * first and only then removed locally, so a failure never loses a report.
 */
export async function importLocalReports<C extends { title: string }>(local: ReportStore<C>, server: ReportStore<C>): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: [] }
  for (const report of await local.list()) {
    try {
      await server.save({ config: report.config })
    } catch (err) {
      result.failed.push({ title: report.config.title, reason: err instanceof Error ? err.message : String(err) })
      continue
    }
    await local.remove(report.id)
    result.imported++
  }
  return result
}
