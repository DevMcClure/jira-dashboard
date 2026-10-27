import { HardDriveUpload } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { importLocalReports } from "@/lib/reports/import-local"
import { localReportStore, onReportsChanged, reportsChanged, reportStore } from "@/lib/reports/store"

/** api mode, authors: move reports saved in this browser (before the server) to the server, once. */
export function ImportLocalReports() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    const load = () =>
      localReportStore.list().then(
        (list) => live && setCount(list.length),
        () => live && setCount(0),
      )
    load()
    const off = onReportsChanged(load)
    return () => {
      live = false
      off()
    }
  }, [])

  if (!count) return null

  const run = async () => {
    setBusy(true)
    const result = await importLocalReports(localReportStore, reportStore)
    setBusy(false)
    setOpen(false)
    reportsChanged()
    if (result.failed.length) {
      toast.warning(`Imported ${result.imported} of ${result.imported + result.failed.length} reports`, {
        description: result.failed.map((f) => `“${f.title}”: ${f.reason}`).join(" "),
      })
    } else {
      toast.success(`Imported ${result.imported} ${result.imported === 1 ? "report" : "reports"}`, { description: "They're under Created by me." })
    }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setOpen(true)} className="text-muted-foreground">
        <HardDriveUpload />
        <span>
          Import {count} from this browser
        </span>
      </SidebarMenuButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Import your local reports?</DialogTitle>
            <DialogDescription>
              {count} {count === 1 ? "report was" : "reports were"} saved in this browser before the server kept them. Importing moves them to the server, so
              you can share them. Any the server refuses (a frozen report from older data) stay here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Not now
            </Button>
            <Button onClick={run} disabled={busy}>
              {busy ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  )
}
