import { Check, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Searchable list of the browser's IANA time zones. */
export function TimeZonePicker({ value, onChange, disabled }: { value: string; onChange: (zone: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
    return all.includes(value) ? all : [value, ...all]
  }, [value])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-64 justify-between font-normal" disabled={disabled} aria-label="Time zone">
          {value.replace(/_/g, " ")}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search time zones…" />
          <CommandList className="max-h-64">
            <CommandEmpty>No time zone found.</CommandEmpty>
            {zones.map((zone) => (
              <CommandItem
                key={zone}
                value={zone}
                onSelect={() => {
                  onChange(zone)
                  setOpen(false)
                }}
              >
                <Check className={cn(zone === value ? "opacity-100" : "opacity-0")} />
                {zone.replace(/_/g, " ")}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
