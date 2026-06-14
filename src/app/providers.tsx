// Spec 002 §5 / §6 — TanStack Query Provider boundary.
//
// Created once per browser tab (stable QueryClient via useState lazy init —
// strictMode double-render must not produce two clients).
//
// Defaults rationale:
//   - `staleTime: 30_000` — spec 002 §1.3. Within 30s, switching tabs back
//     to a previously-fetched resource hits cache (no network).
//   - `gcTime: 5 * 60_000` — keep inactive query data for 5 min so
//     navigating into a detail page and back is instant.
//   - `refetchOnWindowFocus: false` — list endpoints are no-store /
//     time-sensitive (backend spec 016 §11.1); window-focus refetches
//     would create surprise loading spinners without much benefit.
//   - `retry: 1` — single retry covers transient blips; more retries
//     would just delay surfacing the error UI (spec 003h InlineError).

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
