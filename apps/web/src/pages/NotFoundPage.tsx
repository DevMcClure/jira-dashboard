import { Link } from "react-router-dom"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="That page doesn't exist." />
      <div>
        <Button asChild variant="outline">
          <Link to="/">Back to Overview</Link>
        </Button>
      </div>
    </>
  )
}
