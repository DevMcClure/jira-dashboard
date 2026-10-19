import {
  ArrowRightLeft,
  Info,
  LayoutGrid,
  Ticket,
  Timer,
  Upload,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = { title: string; url: string; icon: LucideIcon }
export type NavGroup = { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Explore the Sprints",
    items: [
      { title: "Overview", url: "/", icon: LayoutGrid },
      { title: "Tickets", url: "/tickets", icon: Ticket },
      { title: "Sprints", url: "/sprints", icon: Timer },
      { title: "Teams", url: "/teams", icon: Users },
      { title: "People", url: "/people", icon: User },
      { title: "Movements", url: "/movements", icon: ArrowRightLeft },
    ],
  },
  {
    label: "About the Data",
    items: [
      { title: "Import", url: "/import", icon: Upload },
      { title: "About", url: "/about", icon: Info },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

/** The nav item a pathname belongs to ("/tickets/PLAT-1" → Tickets). */
export function navItemFor(pathname: string): NavItem | undefined {
  if (pathname === "/") return ALL_ITEMS[0]
  return ALL_ITEMS.find((i) => i.url !== "/" && (pathname === i.url || pathname.startsWith(`${i.url}/`)))
}
