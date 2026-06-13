# Spec 003f：LoadingSkeleton

- **狀態**：Draft（v0.2 — 加 `variant` per resource 對齊 003e1/e2/e3 shape）
- **路徑**：`src/components/ui/LoadingSkeleton.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、[003e Cards (index)](./003e-charity-card.md)
- **Figma 對應**：（無對應 frame；Figma 雖有 `shimmer` component `1:1017` 但無 skeleton layout — 本 spec 自定）
- **複用性**：**中** — 接 `variant: ResourceKey` 對應三種卡片 shape；要更通用可抽 `<SkeletonBox className />` 原子 + 各 variant 組合

---

## 1. 職責

提供「卡片骨架」站位，視覺 mirror 對應 resource 的卡片元件。出現時機由消費者控（first paint 多顆、fetch-next-page 少顆）。

v0.4 補件後三 tab 卡片 shape 顯著不同（row vs column vs column+ribbon），skeleton 必須 mirror 對應 shape 才能避免 hydration 時的 layout shift。

---

## 2. Props

```ts
import type { ResourceKey } from '@/lib/schemas/list'

type LoadingSkeletonProps = {
  /** 對應卡片 shape；charity 是 row 排版、donation / item 是 column 排版 */
  variant: ResourceKey
  /** 渲染骨架卡片數量，預設 6 */
  count?: number
}
```

> v0.1 沒有 `variant`；v0.2 改為必填（無 default）— 避免「忘給 variant 直接用 charity row 結果 donation tab 抖一下」。

---

## 3. Anatomy

三種 variant 對應 [003e1](./003e1-charity-card.md) / [003e2](./003e2-donation-project-card.md) / [003e3](./003e3-sale-item-card.md) 的 layout。

### 3.1 容器（list 層，三 variant 共用）

| 元素 | 規格 |
|---|---|
| Container | `flex flex-col gap-3 px-[15px] pt-[15px]` |

### 3.2 `variant='charity'` — mirror 003e1（row）

| 元素 | 規格 |
|---|---|
| Card | `flex items-center gap-3 w-full max-w-[345px] mx-auto px-3 py-[9px] bg-surface-card rounded-xl` |
| Logo placeholder | `w-16 h-16 rounded-[9px] bg-gray-200 animate-pulse shrink-0` |
| Title placeholder | `h-6 w-[60%] rounded bg-gray-200 animate-pulse` |
| Description placeholder | `h-5 w-[80%] rounded bg-gray-200 animate-pulse` |

### 3.3 `variant='donation'` — mirror 003e2（column with cover image）

| 元素 | 規格 |
|---|---|
| Card | `flex flex-col w-full max-w-[345px] mx-auto bg-surface-card rounded-xl overflow-hidden` |
| Cover image placeholder | `w-full aspect-[16/9] bg-gray-200 animate-pulse` |
| Body padding | `px-3 py-3 flex flex-col gap-2` |
| OrganizerLabel placeholder | `h-4 w-[40%] rounded bg-gray-200 animate-pulse` |
| Title placeholder | `h-6 w-[80%] rounded bg-gray-200 animate-pulse` |
| Description placeholder | `h-5 w-full rounded bg-gray-200 animate-pulse` |
| Categories tag row placeholder | `h-6 w-[60%] rounded bg-gray-200 animate-pulse` |

### 3.4 `variant='item'` — mirror 003e3（column with ribbon + price）

| 元素 | 規格 |
|---|---|
| Card | `flex flex-col w-full max-w-[345px] mx-auto bg-surface-card rounded-xl overflow-hidden` |
| Cover image placeholder | `w-full aspect-square bg-gray-200 animate-pulse` |
| Body padding | `px-3 py-3 flex flex-col gap-2` |
| OrganizerLabel placeholder | `h-4 w-[40%] rounded bg-gray-200 animate-pulse` |
| Title placeholder | `h-5 w-[70%] rounded bg-gray-200 animate-pulse` |
| Price placeholder | `h-7 w-[35%] rounded bg-gray-200 animate-pulse` |

> 不繪「公益義賣」絲帶骨架（節省複雜度；絲帶本身是 ribbon overlay，不會影響 layout shift）。

```tsx
'use client'
import type { ResourceKey } from '@/lib/schemas/list'

export function LoadingSkeleton({
  variant,
  count = 6,
}: { variant: ResourceKey; count?: number }) {
  return (
    <div className="flex flex-col gap-3 px-[15px] pt-[15px]" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        switch (variant) {
          case 'charity':  return <CharityCardSkeleton key={i} />
          case 'donation': return <DonationCardSkeleton key={i} />
          case 'item':     return <ItemCardSkeleton key={i} />
        }
      })}
    </div>
  )
}

function CharityCardSkeleton() {
  return (
    <div className="flex items-center gap-3 w-full max-w-[345px] mx-auto px-3 py-[9px] bg-surface-card rounded-xl">
      <div className="w-16 h-16 rounded-[9px] bg-gray-200 animate-pulse shrink-0" />
      <div className="flex-1 flex flex-col gap-[3px] min-w-0">
        <div className="h-6 w-[60%] rounded bg-gray-200 animate-pulse" />
        <div className="h-5 w-[80%] rounded bg-gray-200 animate-pulse" />
      </div>
    </div>
  )
}

function DonationCardSkeleton() {
  return (
    <div className="flex flex-col w-full max-w-[345px] mx-auto bg-surface-card rounded-xl overflow-hidden">
      <div className="w-full aspect-[16/9] bg-gray-200 animate-pulse" />
      <div className="px-3 py-3 flex flex-col gap-2">
        <div className="h-4 w-[40%] rounded bg-gray-200 animate-pulse" />
        <div className="h-6 w-[80%] rounded bg-gray-200 animate-pulse" />
        <div className="h-5 w-full rounded bg-gray-200 animate-pulse" />
        <div className="h-6 w-[60%] rounded bg-gray-200 animate-pulse" />
      </div>
    </div>
  )
}

function ItemCardSkeleton() {
  return (
    <div className="flex flex-col w-full max-w-[345px] mx-auto bg-surface-card rounded-xl overflow-hidden">
      <div className="w-full aspect-square bg-gray-200 animate-pulse" />
      <div className="px-3 py-3 flex flex-col gap-2">
        <div className="h-4 w-[40%] rounded bg-gray-200 animate-pulse" />
        <div className="h-5 w-[70%] rounded bg-gray-200 animate-pulse" />
        <div className="h-7 w-[35%] rounded bg-gray-200 animate-pulse" />
      </div>
    </div>
  )
}
```

> 用內部 3 個 sub-component 比 inline switch case 容易讀；3 個 component 不對外 export，只給 variant dispatch 用。

---

## 4. 使用情境

| 來源 | 渲染 |
|---|---|
| [003j ResourceInfiniteList](./003j-charity-list.md) status === `pending` | `<LoadingSkeleton variant={resource} count={6} />` |
| 同上 isFetchingNextPage | `<LoadingSkeleton variant={resource} count={2} />` |
| `src/app/charities/loading.tsx` | `<LoadingSkeleton variant="charity" count={6} />`（default tab 是 charity）|

---

## 5. 變體

`variant` 三選一；無其他變體（顏色、shape、animation 都不可配）。

---

## 6. 測試（colocated `LoadingSkeleton.test.tsx`）

- `variant='charity'` count=3 → 渲染 3 張 row-layout skeleton
- `variant='donation'` count=3 → 渲染 3 張 column-with-cover skeleton；aspect-[16/9]
- `variant='item'` count=3 → 渲染 3 張 column-with-square skeleton；aspect-square
- count=0 → 渲染 0 張（不爆）
- 三 variant 整片都 `aria-hidden`

---

## 7. a11y

- `aria-hidden` 整片標記（避免 SR 讀「灰底矩形」雜訊）
- screen reader 等到實際資料載入後才開始讀（list semantic 由 [003j ResourceInfiniteList](./003j-charity-list.md) 提供）
- 視覺上 `animate-pulse` 對某些低視力使用者可能太刺激；可加 `motion-reduce:animate-none`

---

## 8. 開放問題

- **shimmer vs pulse**：Tailwind 預設 pulse 是 fade in/out。shimmer 是 gradient 從左滑到右，視覺更精緻但需要 custom keyframe
- **prefers-reduced-motion**：要不要主動 `motion-reduce:animate-none` 改善 a11y？建議加但不強制
- **count 的「智慧」預設**：一屏約 6 張 charity card，但 donation / item 因為高度大，4 張可能就滿屏；可未來 per-variant default

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-13 | 初版（mirror CharityCard row 結構） |
| 0.2 | 2026-06-14 | 加 `variant: ResourceKey` 必填 prop；三種 sub-skeleton（charity / donation / item）對應 003e1/e2/e3 shape |
