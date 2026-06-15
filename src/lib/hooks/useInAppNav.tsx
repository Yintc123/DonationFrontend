'use client'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'

/**
 * Spec 005 §4 — track whether the user has performed any in-app navigation
 * during this tab session. The flag is in-memory only (intentional): refresh
 * resets it because semantically a refresh is "fresh session" — we don't
 * want a refreshed page's back button to chase stale browser history.
 *
 * Consumed by `useSmartBack(fallback)` to decide between `router.back()`
 * (we know they came from somewhere inside) and `router.push(fallback)`
 * (no in-app history → go to a sensible landing).
 *
 * Plug `<InAppNavProvider>` once near the root (currently `app/providers.tsx`).
 * Hook callers outside the provider receive `false`, which keeps behaviour
 * safe (fallback fires) instead of throwing.
 */
const Ctx = createContext(false)

export function InAppNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // Snapshot the pathname at first mount. Any later change to pathname
  // means the user navigated inside the app.
  const initial = useRef(pathname)
  const [hasNavigated, setHasNavigated] = useState(false)
  useEffect(() => {
    if (!hasNavigated && pathname !== initial.current) {
      setHasNavigated(true)
    }
  }, [pathname, hasNavigated])
  return <Ctx.Provider value={hasNavigated}>{children}</Ctx.Provider>
}

export function useHasInAppNavigated(): boolean {
  return useContext(Ctx)
}
