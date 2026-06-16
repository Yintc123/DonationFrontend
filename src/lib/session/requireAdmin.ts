import 'server-only'
import { redirect } from 'next/navigation'
import { getSessionService } from './service'
import { Role, type StoredSession } from './types'

/**
 * Spec 011 §3.5 — RSC admin gate.
 *
 * Null session OR non-admin role → redirect to `/?reason=cms-not-admin`.
 * `AuthRedirectToast` (spec 010 §3.3) handles the `cms-not-admin` reason
 * with `toast.error('需要管理員權限')`.
 *
 * For BFF route handlers use `createAdminRoute()` instead; this helper
 * is for RSC (page.tsx / layout.tsx) where `redirect()` works.
 */
export async function requireAdminSession(): Promise<StoredSession> {
  const session = await getSessionService().get()
  if (!session || session.role !== Role.ADMIN) {
    redirect('/?reason=cms-not-admin')
  }
  return session
}
