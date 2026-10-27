import { Users, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/useAuth"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import type { DirectoryResults } from "@/lib/auth/auth-client"
import type { ReportRecipients, StoredReport } from "@/lib/reports/report-store"
import { shareReport } from "@/lib/reports/store"
import type { ReportConfig } from "@jira-dashboard/core/report-config"

type Props = { report: StoredReport<ReportConfig> | null; onOpenChange: (open: boolean) => void }

/** Choose the people and groups a report is shared with (owner, api mode). */
export function ShareDialog({ report, onOpenChange }: Props) {
  return (
    <Dialog open={report !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{report && <ShareForm report={report} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

const DEBOUNCE_MS = 250

function ShareForm({ report, onDone }: { report: StoredReport<ReportConfig>; onDone: () => void }) {
  const { searchDirectory } = useAuth()
  const me = useCurrentUser()?.user.id
  const [recipients, setRecipients] = useState<ReportRecipients>(report.recipients ?? { users: [], groups: [] })
  const [query, setQuery] = useState("")
  const [found, setFound] = useState<{ query: string; results: DirectoryResults | null; error: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const q = query.trim()

  useEffect(() => {
    if (q.length < 2) return
    let live = true
    const timer = window.setTimeout(() => {
      searchDirectory(q).then(
        (results) => live && setFound({ query: q, results, error: null }),
        (err: Error) => live && setFound({ query: q, results: null, error: err.message }),
      )
    }, DEBOUNCE_MS)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [q, searchDirectory])

  const current = found?.query === q ? found : null
  const people = (current?.results?.users ?? []).filter((u) => u.id !== me && !recipients.users.some((r) => r.id === u.id))
  const groups = (current?.results?.groups ?? []).filter((g) => !recipients.groups.includes(g))
  const addUser = (u: { id: string; displayName: string }) => setRecipients((r) => ({ ...r, users: [...r.users, { id: u.id, displayName: u.displayName }] }))
  const addGroup = (g: string) => setRecipients((r) => ({ ...r, groups: [...r.groups, g] }))

  const save = async () => {
    setBusy(true)
    try {
      await shareReport(report.id, recipients)
      const n = recipients.users.length + recipients.groups.length
      toast.success(n ? `Shared “${report.config.title}”` : `“${report.config.title}” is private now`, {
        description: n ? "They'll find it under Shared with me when they sign in." : undefined,
      })
      onDone()
    } catch (err) {
      toast.error("Couldn't share the report", { description: (err as Error).message })
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share “{report.config.title}”</DialogTitle>
        <DialogDescription>People and groups you add can open this report with its filters locked. Only you can change it.</DialogDescription>
      </DialogHeader>

      <Command shouldFilter={false} className="rounded-lg border">
        <CommandInput placeholder="Find a person or a group…" value={query} onValueChange={setQuery} autoFocus />
        <CommandList className="max-h-56">
          <CommandEmpty>
            {q.length < 2 ? "Type at least 2 characters." : current?.error ? current.error : current ? "Nobody found." : "Searching…"}
          </CommandEmpty>
          {people.length > 0 && (
            <CommandGroup heading="People">
              {people.map((u) => (
                <CommandItem key={u.id} value={`user:${u.id}`} onSelect={() => addUser(u)}>
                  <span className="truncate">{u.displayName}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{u.email ?? u.id}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {groups.length > 0 && (
            <CommandGroup heading="Groups">
              {groups.map((g) => (
                <CommandItem key={g} value={`group:${g}`} onSelect={() => addGroup(g)}>
                  <Users />
                  <span className="truncate">{g}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Shared with</p>
        {recipients.users.length + recipients.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody yet: only you can see it.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {recipients.users.map((u) => (
              <li key={u.id}>
                <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                  {u.displayName}
                  <button type="button" className="rounded-sm opacity-70 hover:opacity-100" aria-label={`Remove ${u.displayName}`} onClick={() => setRecipients((r) => ({ ...r, users: r.users.filter((x) => x.id !== u.id) }))}>
                    <X className="size-3" />
                  </button>
                </Badge>
              </li>
            ))}
            {recipients.groups.map((g) => (
              <li key={g}>
                <Badge variant="outline" className="gap-1 pr-1 font-normal">
                  <Users className="size-3" />
                  {g}
                  <button type="button" className="rounded-sm opacity-70 hover:opacity-100" aria-label={`Remove group ${g}`} onClick={() => setRecipients((r) => ({ ...r, groups: r.groups.filter((x) => x !== g) }))}>
                    <X className="size-3" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  )
}
