import { format } from "date-fns"
import { Send } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { JiraDataset } from "@jira-dashboard/core/types"

type Props = {
  fileName: string
  /** The previewed file's data, to say what everyone will see. */
  dataset: JiraDataset
  busy: boolean
  onPublish: () => void
}

/** api mode, admins: send the previewed file to the server, after a confirmation. */
export function PublishCard({ fileName, dataset, busy, onPublish }: Props) {
  const [confirming, setConfirming] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-4" />
          Publish to server
        </CardTitle>
        <CardDescription>
          You're previewing {fileName} in this browser only. Publishing makes it the server's data for everyone, until the
          Trawler's next run replaces it.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setConfirming(true)} disabled={busy}>
            <Send />
            {busy ? "Publishing…" : "Publish…"}
          </Button>
        </CardAction>
      </CardHeader>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish {fileName}?</DialogTitle>
            <DialogDescription>
              Everyone will see this data: {dataset.teams.length} teams, {dataset.sprints.length} sprints and{" "}
              {dataset.issues.length} tickets, generated {format(dataset.meta.generatedAt, "d MMM yyyy, HH:mm")}. The
              server checks it first; if it isn't valid, nothing changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirming(false)
                onPublish()
              }}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
