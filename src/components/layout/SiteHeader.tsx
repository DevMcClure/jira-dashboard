import { Fragment } from "react"
import { Link, useLocation, useMatch } from "react-router-dom"
import { GlobalFilters } from "@/components/filters/GlobalFilters"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { LogoMark } from "./LogoMark"
import { navItemFor } from "./nav"

export function SiteHeader() {
  const { pathname } = useLocation()
  const key = useMatch("/tickets/:key")?.params.key
  const item = navItemFor(pathname)
  const crumbs = [item?.title ?? "Not found", ...(key ? [key] : [])]

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((c, i) => (
            <Fragment key={c}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="truncate">
                {i < crumbs.length - 1 && item ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.url}>{c}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className={key && i > 0 ? "font-mono" : undefined}>{c}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <GlobalFilters />
        <ThemeToggle />
        <LogoMark />
      </div>
    </header>
  )
}
