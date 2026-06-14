'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Spec 002 §7.2 — useUrlSync
 *
 * 把指定的 keys 同步進 URL `?key=value`：
 *  - 值為非空 string → set
 *  - 值為空字串 / undefined → delete
 *  - 既有 search params（如 utm=abc）保留
 *
 * 一律用 `router.replace({ scroll: false })`：
 *  - replace 而非 push：tab/q/category 切換不污染 history
 *  - scroll: false：避免每次 URL 變動 scroll-to-top
 *  - back/forward 的 scroll 由 browser history state 處理（不受影響）
 */
export function useUrlSync(params: Record<string, string | undefined>): void {
  const router = useRouter()
  const searchParams = useSearchParams()
  const depsValues = Object.values(params)

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(params)) {
      if (v && v.length > 0) next.set(k, v)
      else next.delete(k)
    }
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : '', { scroll: false })
    // params is a fresh object each render; flatten value-deps so the effect
    // only re-fires when an actual value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams, ...depsValues])
}
