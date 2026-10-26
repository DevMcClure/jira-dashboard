import { Link } from "react-router-dom"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { useAppPath } from "@/hooks/useAppPath"
import { useReportMode } from "@/hooks/useReportMode"
import { pagePath, REPORT_PAGES } from "@/lib/reports/report-config"

/** Shown for any path inside a report that isn't one of its pages (e.g. a link to the Tickets page). */
export function NotInReport() {
  const report = useReportMode()
  const to = useAppPath()
  const pages = REPORT_PAGES.filter((p) => report?.config.pages.includes(p.id))
  return (
    <>
      <PageHeader
        title="Not part of this report"
        description="This report only includes the pages below. Use “Explore from here” in the banner to see everything with the report's filters."
      />
      <div className="flex flex-wrap gap-2">
        {pages.map((p) => (
          <Button key={p.id} variant="outline" size="sm" asChild>
            <Link to={to(pagePath(p.id))}>{p.title}</Link>
          </Button>
        ))}
      </div>
    </>
  )
}
