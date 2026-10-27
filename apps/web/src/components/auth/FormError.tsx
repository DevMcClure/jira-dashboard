import { CircleAlert } from "lucide-react"

/** An inline error under a sign-in form (no toaster is mounted before sign-in). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  )
}
