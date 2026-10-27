/**
 * A stand-in for Atlassian Crowd's REST usermanagement API, for tests and for
 * trying AUTH_PROVIDER=crowd locally. Implements only what crowd-provider.ts
 * calls, checks the application's Basic auth like Crowd does, and listens on
 * 127.0.0.1 with a random port. Never part of the server build.
 */
import { randomUUID } from "node:crypto"
import { createServer, type IncomingMessage } from "node:http"
import type { AddressInfo } from "node:net"

export type MockCrowdUser = { password: string; displayName: string; email: string; groups: string[]; active?: boolean }
type Options = { app: { name: string; password: string }; users: Record<string, MockCrowdUser> }

const json = async (req: IncomingMessage) => {
  let body = ""
  for await (const chunk of req) body += chunk
  return body ? JSON.parse(body) : {}
}

export async function startMockCrowd({ app, users }: Options) {
  const sessions = new Map<string, string>() // token → username
  const calls: string[] = []
  const expected = `Basic ${Buffer.from(`${app.name}:${app.password}`).toString("base64")}`

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://crowd")
    const path = url.pathname.replace(/^\/crowd\/rest\/usermanagement\/1/, "")
    calls.push(`${req.method} ${path}`)
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, body ? { "content-type": "application/json" } : {})
      res.end(body ? JSON.stringify(body) : undefined)
    }
    if (req.headers.authorization !== expected) return send(401, { reason: "APPLICATION_ACCESS_DENIED", message: "Application failed to authenticate" })

    if (req.method === "POST" && path === "/session") {
      const { username, password } = await json(req)
      const user = users[username]
      if (!user || user.password !== password) return send(400, { reason: "INVALID_USER_AUTHENTICATION", message: "Failed to authenticate principal" })
      if (user.active === false) return send(400, { reason: "INACTIVE_ACCOUNT", message: "Account is inactive" })
      const token = randomUUID().replace(/-/g, "")
      sessions.set(token, username)
      return send(201, { token, user: { name: username } })
    }
    const sessionMatch = path.match(/^\/session\/([^/]+)$/)
    if (sessionMatch) {
      const token = decodeURIComponent(sessionMatch[1])
      if (req.method === "POST") return sessions.has(token) ? send(200, { token, user: { name: sessions.get(token) } }) : send(404, { reason: "INVALID_SSO_TOKEN" })
      if (req.method === "DELETE") {
        sessions.delete(token)
        return send(204)
      }
    }
    if (req.method === "GET" && path === "/user") {
      const name = url.searchParams.get("username") ?? ""
      const user = users[name]
      return user ? send(200, { name, "display-name": user.displayName, email: user.email, active: user.active !== false }) : send(404, { reason: "USER_NOT_FOUND" })
    }
    if (req.method === "GET" && path === "/user/group/nested") {
      const user = users[url.searchParams.get("username") ?? ""]
      return user ? send(200, { groups: user.groups.map((name) => ({ name })) }) : send(404, { reason: "USER_NOT_FOUND" })
    }
    send(404, { reason: "NOT_FOUND" })
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  return {
    /** What you'd put in CROWD_URL. */
    url: `http://127.0.0.1:${port}/crowd`,
    sessions,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
