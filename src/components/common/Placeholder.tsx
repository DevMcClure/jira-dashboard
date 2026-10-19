import { Card, CardContent } from "@/components/ui/card"

/** Temporary body for pages not built yet. */
export function Placeholder({ phase }: { phase: number }) {
  return (
    <Card>
      <CardContent className="py-16 text-center text-sm text-muted-foreground">
        Coming in phase {phase}.
      </CardContent>
    </Card>
  )
}
