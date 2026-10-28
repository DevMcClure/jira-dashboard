import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

/** Closed by default: charts that break down what the main views already show. Nothing inside renders until it's opened. */
export function MoreDetail({ children }: { children: ReactNode }) {
  return (
    <Collapsible asChild>
      <Card className="gap-0">
        <CardHeader>
          <CardTitle>More detail</CardTitle>
          <CardDescription>
            Per-item flow time, WIP against throughput, item sizes and predictability per PI.
          </CardDescription>
          <CardAction>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="group">
                <span className="group-data-[state=open]:hidden">Show</span>
                <span className="hidden group-data-[state=open]:inline">Hide</span>
                <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          </CardAction>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
