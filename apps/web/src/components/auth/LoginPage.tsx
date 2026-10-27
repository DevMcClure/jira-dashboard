import { Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogoMark } from "@/components/layout/LogoMark"
import type { ServerConfig } from "@/lib/auth/auth-client"
import { PasswordForm } from "./PasswordForm"
import { PersonaPicker } from "./PersonaPicker"

const DESCRIPTIONS: Record<ServerConfig["authProvider"], string> = {
  mock: "Demo sign-in: pick who to be.",
  crowd: "Use your company username and password.",
  oidc: "Single sign-on isn't set up on this server yet.",
}

/** The sign-in page (api mode): personas with mock sign-in, a username and password with Crowd. */
export function LoginPage({ provider, notice }: { provider: ServerConfig["authProvider"]; notice: string | null }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-3 flex items-center gap-2">
            <LogoMark />
            <span className="text-sm font-semibold">Jira Dashboard</span>
          </div>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>{DESCRIPTIONS[provider]}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {notice && (
            <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0" />
              {notice}
            </p>
          )}
          {provider === "mock" && <PersonaPicker />}
          {provider === "crowd" && <PasswordForm />}
        </CardContent>
      </Card>
    </main>
  )
}
