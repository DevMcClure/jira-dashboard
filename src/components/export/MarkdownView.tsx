import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/** Markdown elements mapped onto shadcn/theme styling (no typography plugin). */
const COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="mb-2 text-2xl font-semibold tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-8 mb-3 border-b pb-2 text-lg font-semibold tracking-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 mb-2 text-base font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-3 text-sm leading-relaxed">{children}</p>,
  em: ({ children }) => <em className="text-muted-foreground">{children}</em>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5 text-sm">{children}</ul>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="font-mono underline underline-offset-4 hover:text-primary">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-hidden rounded-lg border">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader className="bg-muted/50">{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell className="tabular-nums">{children}</TableCell>,
}

/** Renders a Markdown string (GitHub-flavoured, so tables work). */
export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {markdown}
    </Markdown>
  )
}
