import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useData } from "@/hooks/useData"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = {
  personId: string | null
  showName?: boolean
  size?: "sm" | "md"
  className?: string
}

/** Avatar (image or initials) with optional name; null = Unassigned. */
export function PersonAvatar({ personId, showName = true, size = "sm", className }: Props) {
  const { dataset } = useData()
  const person = personId ? dataset.personById.get(personId) : undefined
  const name = person?.displayName ?? (personId ? `Unknown (${personId})` : "Unassigned")
  const dim = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs"

  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar className={cn(dim, "shrink-0")}>
        {person?.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
        <AvatarFallback className={cn(!personId && "border border-dashed bg-transparent")}>
          {personId ? initials(name) : "–"}
        </AvatarFallback>
      </Avatar>
      {showName && <span className={cn("truncate", !personId && "text-muted-foreground")}>{name}</span>}
    </span>
  )
}
