import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/hooks/useData"
import { initials } from "@/lib/format"

/** Overlapping avatars with a "+N" overflow chip. */
export function AvatarStack({ personIds, max = 5 }: { personIds: string[]; max?: number }) {
  const { dataset } = useData()
  const shown = personIds.slice(0, max)
  const extra = personIds.length - shown.length
  return (
    <div className="flex -space-x-1.5">
      {shown.map((id) => {
        const name = dataset.personById.get(id)?.displayName ?? id
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Avatar className="size-8 text-[11px] ring-2 ring-card">
                <AvatarFallback className="bg-muted">{initials(name)}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{name}</TooltipContent>
          </Tooltip>
        )
      })}
      {extra > 0 && (
        <Avatar className="size-8 text-[11px] ring-2 ring-card">
          <AvatarFallback>+{extra}</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
