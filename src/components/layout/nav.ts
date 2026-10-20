import {
  ArrowRightLeft,
  FileDown,
  HeartPulse,
  Info,
  LayoutDashboard,
  LayoutGrid,
  Milestone,
  Ticket,
  Timer,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react"

export type NavItem = { title: string; url: string; icon: LucideIcon }
export type NavGroup = { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Explore the Sprints",
    items: [
      { title: "Overview", url: "/", icon: LayoutGrid },
      { title: "PI", url: "/pi", icon: Milestone },
      { title: "Details", url: "/details", icon: LayoutDashboard },
      { title: "Health", url: "/health", icon: HeartPulse },
      { title: "Tickets", url: "/tickets", icon: Ticket },
      { title: "Sprints", url: "/sprints", icon: Timer },
      { title: "People", url: "/people", icon: User },
      { title: "Movements", url: "/movements", icon: ArrowRightLeft },
    ],
  },
  {
    label: "About the Data",
    items: [
      { title: "Import", url: "/import", icon: Upload },
      { title: "Export", url: "/export", icon: FileDown },
      { title: "About", url: "/about", icon: Info },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

/** The nav item a pathname belongs to ("/tickets/PLAT-1" → Tickets, "/teams/X" → Overview). */
export function navItemFor(pathname: string): NavItem | undefined {
  if (pathname === "/" || pathname.startsWith("/teams/")) return ALL_ITEMS[0]
  return ALL_ITEMS.find((i) => i.url !== "/" && (pathname === i.url || pathname.startsWith(`${i.url}/`)))
}
