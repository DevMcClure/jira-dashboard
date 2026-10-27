/**
 * Who may do what with a report (docs/decisions/0040): its owner, and the
 * people and groups it's shared with. Nobody else, admins included.
 */
import type { ReportDoc } from "../db"

export type Reader = { id: string; groups: string[] }

export const isOwner = (report: ReportDoc, reader: Reader) => report.ownerId === reader.id

/** Owner, a recipient by name, or in a recipient group. */
export function canRead(report: ReportDoc, reader: Reader): boolean {
  return (
    isOwner(report, reader) ||
    report.recipients.users.some((u) => u.id === reader.id) ||
    report.recipients.groups.some((g) => reader.groups.includes(g))
  )
}

/** Unread for a recipient: never opened, or changed since they last opened it. Owners never see their own as unread. */
export function isUnread(report: ReportDoc, reader: Reader, lastRead: Date | undefined): boolean {
  if (isOwner(report, reader)) return false
  return !lastRead || lastRead < report.updatedAt
}
