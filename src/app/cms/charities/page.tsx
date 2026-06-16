// Spec 011a §3 — /cms/charities admin list.

import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminPageShell } from '@/components/cms/AdminPageShell'
import { AdminTable, type AdminTableColumn } from '@/components/cms/AdminTable'

import { backendFetch } from '@/lib/api/backend'
import { ContractViolationError } from '@/lib/errors/ContractViolationError'
import {
  BackendAdminCharityListResponse,
  type BackendAdminCharityListItem,
} from '@/lib/schemas/admin-detail'
import { getSessionService } from '@/lib/session/service'
import {
  ensureAdminAccess,
  requireAdminSession,
} from '@/lib/session/requireAdmin'

export const metadata: Metadata = {
  title: '公益團體 | JKODonation',
}

async function fetchAdminCharityList(): Promise<BackendAdminCharityListItem[]> {
  // BE 026 §5.1.1 — admin list endpoint (limit cap 100). Returns rows
  // with admin lifecycle metadata (displayOrder / publish window / etc).
  // v0.1 fetches 100 in one go; pagination chrome lands in v0.2.
  //
  // Pass session so backendFetch attaches Bearer — /cms/* is admin-gated
  // on BE and a missing Authorization header returns 401.
  const session = await getSessionService().get()
  const { data } = await backendFetch<unknown>(
    '/cms/donation/charities?limit=100',
    { session },
  )
  const parsed = BackendAdminCharityListResponse.safeParse(data)
  if (!parsed.success) {
    throw new ContractViolationError(
      `Admin charity list schema mismatch: ${parsed.error.message}`,
    )
  }
  return parsed.data.items
}

function fmtLocal(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 已下架 = publishEndAt 不為 null 且早於 `now`。`now` 由 caller 傳入
// 避免每 cell 各自 `new Date()` 漂移。
function isExpired(end: string | null, now: Date): boolean {
  if (!end) return false
  const t = new Date(end)
  return !Number.isNaN(t.getTime()) && t <= now
}

function buildColumns(
  now: Date,
): AdminTableColumn<BackendAdminCharityListItem>[] {
  return [
    { header: '名稱', cell: (r) => r.name, width: 'flex-1' },
    {
      header: '類別',
      cell: (r) =>
        r.categories.length > 0
          ? r.categories.map((c) => c.displayName).join(' / ')
          : '—',
      width: 'w-40',
    },
    {
      header: '排序',
      cell: (r) => r.displayOrder,
      width: 'w-16',
      align: 'right',
    },
    {
      header: '上架時間',
      cell: (r) => fmtLocal(r.publishStartAt),
      width: 'w-40',
    },
    {
      header: '下架時間',
      cell: (r) =>
        isExpired(r.publishEndAt, now) ? (
          <>
            {fmtLocal(r.publishEndAt)}{' '}
            <span className="text-[10px]">（已下架）</span>
          </>
        ) : (
          fmtLocal(r.publishEndAt)
        ),
      width: 'w-52',
    },
    {
      header: '操作',
      cell: (r) => (
        <Link
          href={`/cms/charities/${r.id}/edit`}
          className="text-ink-link text-xs underline-offset-2 hover:underline"
        >
          編輯
        </Link>
      ),
      width: 'w-16',
      align: 'right',
    },
  ]
}

export default async function CharityListPage() {
  await requireAdminSession()
  const items = await ensureAdminAccess(fetchAdminCharityList)
  const now = new Date()
  return (
    <AdminPageShell
      title="公益團體"
      backHref="/cms"
      actions={
        <Link
          href="/cms/charities/new"
          className="w-full h-11 rounded-full bg-brand text-white text-sm font-semibold
                     flex items-center justify-center
                     focus-visible:outline focus-visible:outline-2
                     focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          + 新增
        </Link>
      }
    >
      <AdminTable
        columns={buildColumns(now)}
        rows={items}
        rowKey={(r) => r.id}
        rowClassName={(r) =>
          isExpired(r.publishEndAt, now) ? 'text-brand' : undefined
        }
        caption="公益團體清單"
      />
    </AdminPageShell>
  )
}
