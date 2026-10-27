import { LogIn } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { FormError } from "./FormError"

/** Username and password, checked by the server against Crowd. Nothing is stored in the browser. */
export function PasswordForm() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(username.trim(), password)
    } catch (err) {
      setError((err as Error).message)
      setPassword("")
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-1.5">
        <Label htmlFor="login-username">Username</Label>
        <Input id="login-username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required aria-invalid={!!error} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="login-password">Password</Label>
        <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required aria-invalid={!!error} />
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={busy || !username.trim() || !password}>
        <LogIn />
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
