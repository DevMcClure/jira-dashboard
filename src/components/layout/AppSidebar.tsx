import { format } from "date-fns"
import { Fragment } from "react"
import { ChevronsUpDown, Layers, RotateCcw, Upload } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useData } from "@/hooks/useData"
import { NAV_GROUPS, navItemFor } from "./nav"
import { NavUser } from "./NavUser"

export function AppSidebar() {
  const { pathname } = useLocation()
  const active = navItemFor(pathname)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <AppSwitcher />
        <DataSourceLine />
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group, i) => (
          <Fragment key={group.label}>
            {i > 0 && <SidebarSeparator className="mx-4 data-[orientation=horizontal]:w-auto" />}
            <SidebarGroup>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active?.url === item.url} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function AppSwitcher() {
  const navigate = useNavigate()
  const { source, resetToSample } = useData()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Sprint Atlas</span>
                <span className="truncate text-xs text-muted-foreground">Jira insights</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Data source</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => navigate("/import")}>
              <Upload />
              Import a JSON export…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={source.kind === "sample"} onSelect={resetToSample}>
              <RotateCcw />
              Reset to sample data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function DataSourceLine() {
  const { source, dataset } = useData()
  const name = source.kind === "sample" ? "sample" : source.fileName
  return (
    <p
      className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
      title={name}
    >
      Data: {name} · generated {format(dataset.meta.generatedAt, "d MMM yyyy")}
    </p>
  )
}
