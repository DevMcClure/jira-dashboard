import { Lock } from "lucide-react"
import { Fragment } from "react"
import { Link, matchPath } from "react-router-dom"
import { GlobalFilters } from "@/components/filters/GlobalFilters"
import { PeriodPicker } from "@/components/filters/PeriodPicker"
import { ScopePicker } from "@/components/filters/ScopePicker"
import { SaveReportButton } from "@/components/reports/SaveReportButton"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAppPath, useInnerPath } from "@/hooks/useAppPath"
import { useData } from "@/hooks/useData"
import { useReportMode } from "@/hooks/useReportMode"
import { LogoMark } from "./LogoMark"
import { navItemFor } from "./nav"

export function SiteHeader() {
  // Inside a report, paths are relative to the report's base.
  const pathname = useInnerPath()
  const to = useAppPath()
  const locked = useReportMode() !== null
  const { dataset } = useData()
  const key = matchPath("/tickets/:key", pathname)?.params.key
  const teamId = matchPath("/teams/:teamId", pathname)?.params.teamId
  const item = navItemFor(pathname)
  const leaf = key ?? (teamId ? (dataset.teamById.get(teamId)?.name ?? teamId) : undefined)
  const crumbs = [item?.title ?? "Not found", ...(leaf ? [leaf] : [])]

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
                    <Link to={to(item.url)}>{c}</Link>
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
        {locked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex size-8 items-center justify-center text-muted-foreground" aria-label="Filters are locked by this report">
                <Lock className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Locked by this report. Use “Explore from here” to change them.</TooltipContent>
          </Tooltip>
        )}
        <ScopePicker disabled={locked} />
        <PeriodPicker disabled={locked} />
        <GlobalFilters disabled={locked} />
        <SaveReportButton />
        <ThemeToggle />
        <LogoMark />
      </div>
    </header>
  )
}
