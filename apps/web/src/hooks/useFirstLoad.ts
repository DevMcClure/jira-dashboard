import { useEffect, useState } from "react"

/** Set once the app has shown its first skeleton pass; later mounts render immediately. */
let firstLoadDone = false

/**
 * True for a short moment on the very first load only, so charts can show
 * skeletons sized like their final content (no layout shift).
 */
export function useFirstLoad(ms = 450): boolean {
  const [loading, setLoading] = useState(!firstLoadDone)
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => {
      firstLoadDone = true
      setLoading(false)
    }, ms)
    return () => clearTimeout(t)
  }, [loading, ms])
  return loading
}
