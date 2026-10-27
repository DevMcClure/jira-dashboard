import { format } from "date-fns"
import { CircleAlert, Info, RotateCcw, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { IssueTypesCard } from "@/components/settings/IssueTypesCard"
import { LabelRulesCard } from "@/components/settings/LabelRulesCard"
import { StatusStatesCard } from "@/components/settings/StatusStatesCard"
import { WorkingHoursCard } from "@/components/settings/WorkingHoursCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useData } from "@/hooks/useData"
import { useFlowConfig } from "@/hooks/useFlowConfig"
import { DATA_MODE } from "@/lib/data/data-mode"
import { sameSettings } from "@/lib/settings/flow-settings-editor"
import { FlowSettingsError } from "@/lib/settings/flow-settings-store"
import { DEFAULT_FLOW_CONFIG, flowConfigProblems, type FlowConfig } from "@jira-dashboard/core/flowConfig"

/** /settings/flow: how statuses, types, labels and working hours feed every flow number. */
export default function FlowSettingsPage() {
  const settings = useFlowConfig()
  // A fresh draft whenever the saved settings change (after Save or Reset).
  return <FlowSettingsForm key={`${settings.updatedAt ?? "defaults"}`} saved={settings.config} />
}

function FlowSettingsForm({ saved }: { saved: FlowConfig }) {
  const { config, isDefault, updatedAt, updatedBy, canEdit, loadError, save, reset } = useFlowConfig()
  const { liveDataset } = useData()
  const [draft, setDraft] = useState<FlowConfig>(saved)
  const [busy, setBusy] = useState(false)
  const [serverProblems, setServerProblems] = useState<string[]>([])
  const [confirmReset, setConfirmReset] = useState(false)

  const types = useMemo(() => [...new Set(liveDataset.issues.map((i) => i.type))], [liveDataset])
  const labels = useMemo(() => [...new Set(liveDataset.issues.flatMap((i) => i.labels))].sort(), [liveDataset])
  const problems = flowConfigProblems(draft)
  const changed = !sameSettings(draft, config)
  const server = DATA_MODE === "api"

  const edit = (next: FlowConfig) => {
    setDraft(next)
    setServerProblems([])
  }

  const onSave = async () => {
    setBusy(true)
    try {
      await save(draft)
      toast.success("Flow settings saved", {
        description: server ? "Flow numbers now use these settings, for everyone. Daily snapshots use them from the next run." : "Flow numbers in this browser now use these settings.",
      })
    } catch (err) {
      setServerProblems(err instanceof FlowSettingsError ? err.problems : [])
      toast.error("Couldn't save the flow settings", { description: (err as Error).message })
      setBusy(false)
    }
  }

  const onReset = async () => {
    setConfirmReset(false)
    setBusy(true)
    try {
      await reset()
      toast.success("Flow settings are back to the defaults")
    } catch (err) {
      toast.error("Couldn't reset the flow settings", { description: (err as Error).message })
      setBusy(false)
    }
  }

  const shown = [...problems, ...serverProblems]
  return (
    <>
      <PageHeader
        title="Flow settings"
        description={
          server
            ? "How statuses, issue types, labels and working hours feed every flow number, for everyone on this server."
            : "How statuses, issue types, labels and working hours feed every flow number. Saved in this browser."
        }
      />

      {(!canEdit || loadError) && (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          {loadError ? `The saved settings couldn't be loaded (${loadError}), so the defaults are in use.` : "Only admins can change these settings; they apply to everyone."}
        </p>
      )}

      <StatusStatesCard config={draft} statuses={liveDataset.statuses} disabled={!canEdit} onChange={edit} />
      <IssueTypesCard config={draft} types={types} disabled={!canEdit} onChange={edit} />
      <LabelRulesCard config={draft} suggestions={labels} disabled={!canEdit} onChange={edit} />
      <WorkingHoursCard config={draft} disabled={!canEdit} onChange={edit} />

      <Card className="sticky bottom-4 z-10 shadow-lg">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-sm text-muted-foreground">
            {shown.length ? (
              <ul className="space-y-1 text-destructive" role="alert">
                {shown.map((p) => (
                  <li key={p} className="flex items-start gap-1.5">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            ) : changed ? (
              "You have unsaved changes."
            ) : isDefault ? (
              "Using the default settings."
            ) : (
              `Last changed${updatedBy ? ` by ${updatedBy.displayName}` : ""}${updatedAt ? ` on ${format(new Date(updatedAt), "d MMM yyyy, HH:mm")}` : ""}.`
            )}
          </div>
          {canEdit && (
            <>
              {changed && (
                <Button variant="ghost" size="sm" onClick={() => edit(config)} disabled={busy}>
                  Discard changes
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} disabled={busy || (isDefault && sameSettings(draft, DEFAULT_FLOW_CONFIG))}>
                <RotateCcw />
                Reset to defaults
              </Button>
              <Button size="sm" onClick={onSave} disabled={busy || !changed || problems.length > 0}>
                <Save />
                {busy ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset the flow settings?</DialogTitle>
            <DialogDescription>
              {server ? "Everyone's flow numbers go back to the default settings." : "Flow numbers in this browser go back to the default settings."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button onClick={onReset}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
