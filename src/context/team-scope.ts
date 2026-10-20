import { createContext } from "react"

/**
 * When set, everything below is scoped to one team (overriding the header's
 * Teams filter). Used by the team detail page to reuse the Details view.
 */
export const TeamScopeContext = createContext<string | null>(null)
