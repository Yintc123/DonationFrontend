/**
 * Spec 002 §3.2 — Resource discriminator (minimal subset for 003 UI components)
 *
 * Full file (含 Zod schemas Charity / Donation / Item / ResourceListItem /
 * ListQuery / ListPage 等) 由 spec 002 實作時補上。本檔目前只 export 003d
 * TabsRow / 003f LoadingSkeleton / 003j ResourceInfiniteList 需要的 type
 * primitives — 避免阻塞 UI 元件 TDD。
 */

export const RESOURCE_KEYS = ['charity', 'donation', 'item'] as const
export type ResourceKey = (typeof RESOURCE_KEYS)[number]

export const RESOURCE_TO_PATH: Record<ResourceKey, string> = {
  charity: '/api/charities',
  donation: '/api/donations',
  item: '/api/items',
}
