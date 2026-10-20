import { LoaderCircle, UploadCloud } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = { onFile: (file: File) => void; busy?: boolean }

const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false

/**
 * Large dashed drop target with a Browse button; accepts one .json file.
 * While mounted, the whole window accepts the drop — otherwise a file released
 * just outside the box makes the browser open it in the tab instead.
 */
export function DropZone({ onFile, busy }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const onFileRef = useRef(onFile)
  const busyRef = useRef(busy)

  useEffect(() => {
    onFileRef.current = onFile
    busyRef.current = busy
  })

  useEffect(() => {
    // dragenter/dragleave fire for every child crossed, so count depth.
    let depth = 0
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = busyRef.current ? "none" : "copy"
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file && !busyRef.current) onFileRef.current(file)
    }
    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragover", onOver)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragover", onOver)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [])

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
        dragging ? "border-primary bg-muted/60" : "border-border bg-card/40",
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        {busy ? (
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1">
        <p className="font-medium">
          Drop a Jira Trawler JSON export here or{" "}
          <button
            type="button"
            className="text-primary underline underline-offset-4 hover:no-underline"
            onClick={() => input.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="text-sm text-muted-foreground">
          The file is read in your browser only — nothing is uploaded anywhere.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
        Browse files…
      </Button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Choose a JSON export"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
