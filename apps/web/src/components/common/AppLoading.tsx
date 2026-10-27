import { RotateCcw, TriangleAlert, Upload } from "lucide-react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageSkeleton } from "./PageSkeleton"

type Props =
  | { state: "loading" }
  | { state: "error"; message: string; onRetry: () => void; onFile: (file: File) => void }

/** Full-screen stand-in for the app until its first data has loaded (or failed to). */
export function AppLoading(props: Props) {
  if (props.state === "error") return <LoadError {...props} />
  return (
    <div className="flex min-h-svh bg-background" aria-busy="true" aria-label="Loading data">
      <div className="hidden w-64 shrink-0 flex-col gap-3 border-r bg-sidebar p-3 md:flex">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b" />
        <div className="p-6">
          <PageSkeleton />
        </div>
      </div>
    </div>
  )
}

function LoadError({ message, onRetry, onFile }: Extract<Props, { state: "error" }>) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" />
            Couldn't load the data
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Try again, or open a Jira Trawler export from your computer instead.
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={onRetry}>
            <RotateCcw />
            Retry
          </Button>
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload />
            Import a file
          </Button>
          <input
            ref={input}
            type="file"
            accept=".json,.log,.txt,application/json,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFile(file)
              e.target.value = ""
            }}
          />
        </CardFooter>
      </Card>
    </div>
  )
}
