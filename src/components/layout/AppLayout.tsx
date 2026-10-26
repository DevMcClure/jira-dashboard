import { Suspense } from "react"
import { Outlet } from "react-router-dom"
import { PageSkeleton } from "@/components/common/PageSkeleton"
import { ReportBanner } from "@/components/reports/ReportBanner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { SiteHeader } from "./SiteHeader"

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="relative min-w-0">
        {/* Faint glow behind the top of the content (dark mode only). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-96 bg-[radial-gradient(ellipse_at_top,var(--color-brand),transparent_70%)] opacity-[0.06] dark:block"
        />
        <SiteHeader />
        <div className="relative flex flex-1 flex-col gap-4 p-6">
          <ReportBanner />
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
