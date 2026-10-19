import { useFilteredIssues } from "@/hooks/useFilteredIssues"

function App() {
  const issues = useFilteredIssues()
  return (
    <div className="dark flex min-h-svh flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">Sprint Atlas</h1>
      <p className="text-muted-foreground tabular-nums">{issues.length} tickets loaded</p>
    </div>
  )
}

export default App
