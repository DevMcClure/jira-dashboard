import { ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import type { Persona } from "@/lib/auth/auth-client"
import { initials } from "@/lib/auth/roles"
import { FormError } from "./FormError"

/** Mock sign-in (AUTH_PROVIDER=mock): one button per demo persona, no password. */
export function PersonaPicker() {
  const { personas, signIn } = useAuth()
  const [list, setList] = useState<Persona[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    personas().then(
      (p) => !cancelled && setList(p),
      (err: Error) => {
        if (cancelled) return
        setList([])
        setError(err.message)
      },
    )
    return () => {
      cancelled = true
    }
  }, [personas])

  const pick = async (username: string) => {
    setBusy(username)
    setError(null)
    try {
      await signIn(username)
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  if (!list) return <Skeleton className="h-40 w-full" />
  return (
    <div className="grid gap-2">
      {list.map((p) => (
        <Button key={p.username} variant="outline" className="h-auto justify-start gap-3 py-2.5" disabled={busy !== null} onClick={() => pick(p.username)}>
          <Avatar className="size-8 rounded-full">
            <AvatarFallback className="rounded-full text-xs">{initials(p.displayName)}</AvatarFallback>
          </Avatar>
          <span className="grid flex-1 text-left leading-tight">
            <span className="font-medium">{p.displayName}</span>
            <span className="text-xs font-normal text-muted-foreground">{p.title}</span>
          </span>
          <ChevronRight className="text-muted-foreground" />
        </Button>
      ))}
      <FormError message={error} />
      <p className="text-xs text-muted-foreground">For development only. Set AUTH_PROVIDER=crowd for real accounts.</p>
    </div>
  )
}
