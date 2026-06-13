# Spec 003j：ResourceInfiniteList（feature）

- **狀態**：Draft（v0.3 — 加 `category` prop 透傳到 hook）
- **路徑**：`src/components/features/ResourceInfiniteList.tsx`
- **依賴**：
  - [003a Design System](./003a-design-system.md)
  - [003e Cards (index)](./003e-charity-card.md) → [003e1 CharityCard](./003e1-charity-card.md) / [003e2 DonationProjectCard](./003e2-donation-project-card.md) / [003e3 SaleItemCard](./003e3-sale-item-card.md)
  - [003f LoadingSkeleton](./003f-loading-skeleton.md) / [003g EmptyState](./003g-empty-state.md) / [003h InlineError](./003h-inline-error.md)
  - [002 §3 ResourceKey](./002-list-data.md#3-schemas--srclibschemaslistts) / [§6.3 useResourceListInfinite](./002-list-data.md#63-useresourcelistinfinite-hook) / [§7.3 useScrollPercentSentinel](./002-list-data.md#73-usescrollpercentsentinel取代-v01-intersectionobserver-rootmargin)
- **Figma 對應**：列表內容區域（`1:2226` 的 List `layout_CKMPF2`、`1:2213` 的 no-data `1:2215`）
- **複用性**：**中**（feature） — 已抽 generic `resource` prop，三 tab 共用本元件。狀態分支邏輯（pending / empty / error / list + sentinel）對所有 cursor-based list 都通用，可未來再抽更通用的 `<InfiniteList queryHook cardComponent />`，但本作業 v0.2 已足夠

---

## 1. 職責

針對特定 resource（charity / donation / item），消費 `useResourceListInfinite` + scroll-percent sentinel，根據 status / items.length / hasNextPage 切換渲染：

- pending（且 active）→ skeleton（variant per resource）
- success 空 → EmptyState
- success 有 → 列表，每筆透過 `<CardForResource resource item />` 分派到對應卡片（[003e §3](./003e-charity-card.md#3-分派dispatch)）
- error → InlineError
- `active=false` → 包 `display:none` 但不 unmount（[Shell §3.1](./003i-charity-list-shell.md#31-三個-list-同時-mount-的取捨)）

本元件由 [`<CharityListShell>`](./003i-charity-list-shell.md) 三次實例化（每個 resource 一次）。

---

## 2. Props

```ts
import type { ResourceKey } from '@/lib/schemas/list'
import type { CategoryKey } from '@/lib/schemas/categories'

type ResourceInfiniteListProps = {
  resource: ResourceKey
  /** 已經是 debounced + trimmed 的 query。空字串代表「無篩選」 */
  q: string
  /** 篩選分類。null = 「全部」(無篩選)。v0.3 新增 */
  category: CategoryKey | null
  /** 是否為目前 active tab；非 active 時包 `display:none`、hook `enabled=false` */
  active: boolean
}
```

---

## 3. 渲染分支

```tsx
'use client'
import { useMemo } from 'react'
import { useResourceListInfinite } from '@/lib/query/list'
import { useScrollPercentSentinel } from '@/lib/hooks/useScrollPercentSentinel'
import { CharityCard } from '@/components/ui/CharityCard'
import { DonationProjectCard } from '@/components/ui/DonationProjectCard'
import { SaleItemCard } from '@/components/ui/SaleItemCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineError } from '@/components/ui/InlineError'

export function ResourceInfiniteList({
  resource,
  q,
  category,
  active,
}: ResourceInfiniteListProps) {
  const {
    data,
    status,
    error,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    refetch,
  } = useResourceListInfinite({
    resource,
    q,
    category,
    enabled: active,
  })

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  )

  useScrollPercentSentinel({
    enabled: active && hasNextPage && !isFetchingNextPage && !isFetchNextPageError,
    onTrigger: () => fetchNextPage(),
    threshold: 0.1, // 距底 10% 觸發；brief 規格 5-10%
  })

  // —— inactive tab：佔位但隱藏 —— ——
  if (!active) {
    return <div hidden aria-hidden />
  }

  // —— pending：first paint —— ——
  if (status === 'pending') return <LoadingSkeleton variant={resource} count={6} />

  // —— error：first page 失敗（無 cached data） —— ——
  if (status === 'error') {
    return <InlineError message={error?.message} onRetry={() => refetch()} />
  }

  // —— success but empty —— ——
  if (items.length === 0) {
    return (
      <EmptyState
        illustration="/figma/empty-no-data.png"
        title={q ? '查無相關資料' : DEFAULT_EMPTY_TITLE[resource]}
        subtitle={q ? '請調整關鍵字再重新搜尋' : undefined}
      />
    )
  }

  // —— success：列表 —— ——
  // 003e3 §3 註：item tab 卡片是 2 欄 grid；charity / donation 維持單欄 stack
  const listClass =
    resource === 'item'
      ? 'grid grid-cols-2 gap-2 px-[15px] pt-[15px] pb-6'
      : 'flex flex-col gap-3 px-[15px] pt-[15px] pb-6'
  return (
    <div className={listClass}>
      {items.map((it) => (
        <CardForResource key={it.id} resource={resource} item={it} />
      ))}

      {isFetchingNextPage && (
        <div className={resource === 'item' ? 'col-span-2' : undefined}>
          <LoadingSkeleton variant={resource} count={2} />
        </div>
      )}

      {isFetchNextPageError && (
        <div className={resource === 'item' ? 'col-span-2' : undefined}>
          <InlineError
            message="載入下一頁失敗"
            onRetry={() => fetchNextPage()}
          />
        </div>
      )}
    </div>
  )
}

// —— Card dispatch ——
// 從 003e §3 抽出；放本檔以集中分派邏輯（避免 003e index 又被 import）
function CardForResource({
  resource,
  item,
}: {
  resource: ResourceKey
  item: Charity | Donation | Item
}) {
  switch (resource) {
    case 'charity':  return <CharityCard         item={item as Charity}  />
    case 'donation': return <DonationProjectCard item={item as Donation} />
    case 'item':     return <SaleItemCard        item={item as Item}     />
  }
}

const DEFAULT_EMPTY_TITLE: Record<ResourceKey, string> = {
  charity:  '目前沒有公益團體',
  donation: '目前沒有捐款專案',
  item:     '目前沒有義賣商品',
}
```

> 用 `<div hidden>` 而非 conditional render：保留 DOM + hook 狀態，切回 tab scroll position 不變。

---

## 4. 狀態組合

| 條件 | 渲染 |
|---|---|
| `!active` | `<div hidden>` 佔位（hook `enabled=false`，不打網路） |
| `active && status='pending'` | `<LoadingSkeleton variant={resource} count={6} />` |
| `active && status='error'`（first page） | `<InlineError onRetry={refetch} />` |
| `active && success && items.length=0 && q` | `<EmptyState />` 「查無相關資料」 |
| `active && success && items.length=0 && !q` | `<EmptyState />` per resource 不同文案 |
| `active && success && items.length>0` | `<CardForResource resource={resource} item={...} />` 列表（per resource layout） |
| 列表 + `isFetchingNextPage` | 列尾接 `<LoadingSkeleton variant={resource} count={2} />` |
| 列表 + `isFetchNextPageError` | 列尾接 `<InlineError onRetry={fetchNextPage} />`；卡片不洗掉 |
| `!hasNextPage`（到底） | sentinel `enabled=false`，自動停 listener |

---

### 4.1 Per-resource list layout

`resource === 'item'` 時 list container 用 `grid grid-cols-2 gap-2`（IMG_4877 義賣商品為 2 欄）；charity / donation 用 `flex flex-col gap-3` 維持單欄 stack。Sentinel 觸發中的 `<LoadingSkeleton>` 與 `<InlineError>` 在 item tab 包 `col-span-2` 跨整列，避免被擠進 grid 單格。

---

## 5. Sentinel 觸發條件

```ts
useScrollPercentSentinel({
  enabled: active && hasNextPage && !isFetchingNextPage && !isFetchNextPageError,
  onTrigger: () => fetchNextPage(),
  threshold: 0.1,
})
```

| 條件 | 為何 |
|---|---|
| `!active` | inactive tab 不該抓 |
| `!hasNextPage` | 到底 |
| `isFetchingNextPage` | 正在抓，避免重複 |
| `isFetchNextPageError` | 剛失敗，user 按 retry 再試 |

`threshold: 0.1` 對應 brief「scroll 距底 10%」；spec 002 §7.3 hook 預設值就是 0.1，這邊顯式寫出來。

---

## 6. 測試（colocated `ResourceInfiniteList.test.tsx`）

> Mock `useResourceListInfinite` 與 `useScrollPercentSentinel`。每個 case 改 hook 回傳值。

| # | 案例 | 期望 |
|---|---|---|
| 1 | `active=false` | 渲染 `<div hidden>`；`useResourceListInfinite` 收到 `enabled: false` |
| 2 | active + status='pending' | 渲染 `<LoadingSkeleton variant={resource} count={6}>`（每個 resource 對應 003e1/e2/e3 shape） |
| 3 | active + status='error' | 渲染 `<InlineError>`，按重試呼叫 refetch |
| 4 | active + success + items=[] + q='foo' | 渲染 EmptyState，title 為「查無相關資料」 |
| 5 | active + success + items=[] + q='' + resource='donation' | 渲染 EmptyState，title 為「目前沒有捐款專案」 |
| 6 | active + success + items=3 筆 + resource='charity' | 渲染 3 張 `<CharityCard>` |
| 6.1 | resource='donation' | 渲染 `<DonationProjectCard>` |
| 6.2 | resource='item' | 渲染 `<SaleItemCard>` |
| 7 | isFetchingNextPage=true | 列尾出現 `<LoadingSkeleton variant={resource} count={2}>`；resource='item' 時包 `col-span-2` |
| 8 | isFetchNextPageError=true | 出現 InlineError（不洗掉卡片） |
| 9 | hasNextPage=false | sentinel hook 收到 `enabled: false` |
| 10 | sentinel 觸 trigger | fetchNextPage 被呼叫 |
| 11 | resource='donation' | `useResourceListInfinite` 收到 resource='donation' |
| 12 | category='animal' | `useResourceListInfinite` 收到 category='animal'，queryKey 變動 |
| 13 | category 從 'animal' 改成 null | hook 重新 fetch（queryKey 不同） |

---

## 7. a11y

- 列表用 `<div>` + 多張卡片元件（各自 `<article>`）；可改 `<ul><li>`-pair 更 semantic
- pending 時 SR 不讀（skeleton `aria-hidden`）
- error 時 SR 立即讀（InlineError `role="alert"`）
- empty 時 SR 讀 EmptyState 的 `<h2>` 與 `<p>`
- `<div hidden>` 時 SR 跳過（HTML `hidden` 屬性）

---

## 8. 開放問題

- **「沒有更多了」底部文字**：Figma 無；目前不加
- **fetch-next-page 失敗的 auto-retry**：目前必須 user 按 retry；可改「N 秒後自動重試 1 次」
- **`<ul><li>` semantic**：list landmark 完整度；可後加
- **virtualized list**：超 1000 筆 DOM 卡頓；可後加 `@tanstack/react-virtual`。本作業資料量不會到
- **pull-to-refresh**：mobile 慣用手勢；本 spec 不做
- **三 list scroll 是否共用 window scroll**：目前 sentinel 用 `window.scrollY`；三 list 同 mount 但只 active 顯示，所以 scroll 量等於 active list 高度，正確。若未來改成「三 list 各自有獨立 scroll container」，sentinel 要改觀察該 container

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-13 | 初版 `CharityList`（單一 resource、IntersectionObserver rootMargin、無 `active` prop） |
| 0.2 | 2026-06-14 | 抽 generic `ResourceInfiniteList`：`resource` prop + `active` lazy 控制 + 改 scroll-percent sentinel + EmptyState 文案 per resource |
| 0.3 | 2026-06-14 | 加 `category: CategoryKey \| null` prop 透傳給 `useResourceListInfinite`；不變 anatomy / 不變狀態切換邏輯 |
| 0.4 | 2026-06-14 | 配合 003e 拆三 component：`<ResourceCard>` → `<CardForResource resource item />` switch dispatch；imports / tests 都改 |
