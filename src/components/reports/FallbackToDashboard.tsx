import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { toast } from "sonner"

/** Tell the user why, then show the normal dashboard. The toast id stops StrictMode showing it twice. */
export function FallbackToDashboard({ message, description }: { message: string; description?: string }) {
  useEffect(() => {
    toast.error(message, { id: "report-fallback", description })
  }, [message, description])
  return <Navigate to="/" replace />
}
