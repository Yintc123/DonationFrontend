# Spec 003e3：SaleItemCard

- **狀態**：Draft（v0.2 — 截圖補件後修正：ribbon 文字「公益標籤」、紅色統一 brand、補完整 a11y / 測試）
- **路徑**：`src/components/ui/SaleItemCard.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、[002 §3.2 `Item` schema](./002-list-data.md#3-schemas--srclibschemaslistts)、[003e Cards (index)](./003e-charity-card.md) §4 共同約定
- **Figma 對應**：IMG_4876（義賣商品 tab 2 欄列表）
- **複用性**：中

---

## 1. 職責

義賣商品卡片：商品圖（top）+ 「公益標籤」絲帶 ribbon banner（左上 overlay）+ 商品名 + 主辦團體名 + **TWD 價格**（紅色加重）。卡片排版為 2 欄 grid（**由 [003j ResourceInfiniteList](./003j-charity-list.md) §4.1 統籌 grid container**）。整張卡可點跳 `/sale-items/:id`。

> v0.2 修正 ribbon 文字：列表頁 IMG_4876 為「公益標籤」（產品標準化緞帶字樣）；詳情頁 IMG_4883 為「公益義賣 SHOP FOR CHANGE」（較完整的活動標）。列表頁 / 詳情頁分別對應。

---

## 2. Props

```ts
import type { Item } from '@/lib/schemas/list'

type SaleItemCardProps = { item: Item }
```

`Item` shape（spec 002 §3.2）：

```ts
{
  id, name, description, logoUrl?,
  charityId, charityName,
  coverImageUrl?,
  priceTwd: number,            // 必有；正整數
  categories?: CategoryKey[],
}
```

> `priceTwd` 為整數 TWD，無小數。展示時用 `Intl.NumberFormat('zh-TW')` 加千分位。
> backend 違反契約給負值 / 小數的情況由 [002 §3.2 Zod schema](./002-list-data.md#3-schemas--srclibschemaslistts) 守住（schema 內 `.int().nonnegative()`）；卡片**不**再做防護。

---

## 3. Anatomy

對齊 IMG_4876（2 欄 grid 內單卡）。

```
┌────────────────────┐
│ ▶公益標籤▶          │  ← ribbon overlay top-left（紅色，白字）
│                    │
│   商品圖           │  ← aspect-square
│   (藍色背景商品照) │
│                    │
├────────────────────┤
│ 北歐天然｜貝比D - 液│  ← title h2 line-clamp-2
│ 體維生素D3食品     │
│ 財團法人台灣紅絲帶  │  ← charityName line-clamp-1（小灰字）
│                    │
│ TWD 1,000          │  ← 紅字 brand
└────────────────────┘
```

| 元素 | Tag | className |
|---|---|---|
| Container | `<article>` 外、`<Link>` 內 | `<article>` `bg-surface-card rounded-xl overflow-hidden border border-line`<br>`<Link>` `flex flex-col w-full hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand rounded-xl` |
| Image wrap | `<div>` | `relative w-full aspect-square` |
| Cover image | `<img>` | `w-full h-full object-cover` |
| Cover fallback | `<div>` | `absolute inset-0 bg-black/5 flex items-center justify-center text-ink-A` |
| Ribbon banner | `<div>` | `absolute top-2 left-0 px-2 py-[2px] bg-brand text-white text-[11px] leading-4 rounded-r-md shadow-sm`；文字「公益標籤」 |
| Body | `<div>` | `flex flex-col gap-1 px-2 py-2` |
| Title | `<h2>` | `text-[13px] font-medium text-ink-AAA leading-[18px] line-clamp-2 min-h-[36px]`（保 2 行高，避免短標題與相鄰卡片高低不齊） |
| Charity name | `<p>` | `text-[11px] leading-4 text-ink-AA line-clamp-1` |
| Price | `<p>` | `text-base font-bold text-brand leading-6`；格式 `TWD {Intl 千分位}` |

> Ribbon 顏色 v0.1 用 `bg-alert`，v0.2 統一改 `bg-brand`（[003a §2 v0.3](./003a-design-system.md#9-變更紀錄) 撤回 alert token）。視覺對齊：列表頁 ribbon 紅、詳情頁 ribbon 紅、CTA 紅、價格紅，全是同一支 brand red。

> Title `min-h-[36px]` 補 2 行高：避免 grid 內相鄰卡片因標題長短不一導致底部錯位。`line-clamp-2` 仍生效（超長截斷）。

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Item } from '@/lib/schemas/list'

const priceFmt = new Intl.NumberFormat('zh-TW')

export function SaleItemCard({ item }: { item: Item }) {
  const [imgFailed, setImgFailed] = useState(false)
  const hasCover = !!item.coverImageUrl && !imgFailed

  return (
    <article className="bg-surface-card rounded-xl overflow-hidden border border-line">
      <Link
        href={`/sale-items/${item.id}`}
        className="flex flex-col w-full hover:shadow-md
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand
                   rounded-xl"
      >
        <div className="relative w-full aspect-square">
          {hasCover ? (
            <img
              src={item.coverImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-black/5 flex items-center justify-center text-ink-A" aria-hidden />
          )}
          <div className="absolute top-2 left-0 px-2 py-[2px] bg-brand text-white
                          text-[11px] leading-4 rounded-r-md shadow-sm">
            公益標籤
          </div>
        </div>
        <div className="flex flex-col gap-1 px-2 py-2">
          <h2 className="text-[13px] font-medium text-ink-AAA leading-[18px]
                         line-clamp-2 min-h-[36px]">
            {item.name}
          </h2>
          <p className="text-[11px] leading-4 text-ink-AA line-clamp-1">
            {item.charityName}
          </p>
          <p className="text-base font-bold text-brand leading-6">
            TWD {priceFmt.format(item.priceTwd)}
          </p>
        </div>
      </Link>
    </article>
  )
}
```

---

## 4. 變體 / 邊界

| 條件 | 行為 |
|---|---|
| `coverImageUrl` `undefined` | 不渲染 `<img>`；渲染 fallback `<div>` |
| `coverImageUrl` 載入失敗 | `onError` → 切 fallback |
| `priceTwd === 0` | 顯示「TWD 0」（不擋；schema 允許 0） |
| `priceTwd === 1330` | 顯示「TWD 1,330」（千分位） |
| `name` 超長 | `line-clamp-2`，第 3 行起 ellipsis |
| `name` 極短（1 行） | 仍佔 2 行高（`min-h-[36px]` 保 baseline 對齊） |
| `charityName` 超長 | `line-clamp-1` |
| `categories` | **不**在卡片渲染（節省空間；categories 移到 [詳情頁 004c](./004c-sale-item-detail.md)） |
| 點擊整張卡 | router push `/sale-items/:id`（[spec 004c](./004c-sale-item-detail.md)） |

---

## 5. a11y

- 卡片唯一 h2 為 `item.name`
- 圖片 `alt=""`（裝飾）
- ribbon 文字「公益標籤」對 SR 為純文字 `<div>` — 對所有商品卡都顯示相同字串，故視為品牌裝飾，SR 讀亦可（不加 `aria-hidden`，因 ribbon 本身傳達「這是公益商品」資訊）
- 價格用 `<p>` 包；不需 `<data value>` 額外語意（詳情頁可加）
- focus-visible 紅框

---

## 6. 測試（colocated `SaleItemCard.test.tsx`）

| # | 案例 | 期望 |
|---|---|---|
| 1 | 渲染商品圖 | `<img src={coverImageUrl} alt="">` 在 DOM |
| 2 | `coverImageUrl` `undefined` | fallback `<div aria-hidden>` 渲染 |
| 3 | 渲染 ribbon | DOM 內含 `<div>公益標籤</div>`（`bg-brand text-white`） |
| 4 | 渲染 h2 title | h2.textContent === `item.name` |
| 5 | 渲染 charityName | p.textContent === `item.charityName` |
| 6 | 價格格式：`priceTwd=1330` | DOM 文字含 `TWD 1,330`（千分位） |
| 7 | 價格格式：`priceTwd=0` | DOM 文字含 `TWD 0` |
| 8 | 價格紅色 | 價格 `<p>` 含 `text-brand` class |
| 9 | 整卡點擊 | `<a href="/sale-items/{id}">` 包整卡 |
| 10 | a11y：卡片唯一 h2 | 只一個 h2 |
| 11 | `categories` 不渲染 | 即使 `item.categories=[a, b]`，DOM 不含 category chip |

---

## 7. 開放問題

- **ribbon 「公益標籤」精確字樣**：IMG_4876 視覺較小不完全清晰；若實作後與 Figma 對比有差異，可在實作 PR 微調（純文字字串）
- **2 欄 grid layout**：由 [003j ResourceInfiniteList §4.1](./003j-charity-list.md#41-per-resource-list-layout) 統籌；若未來要 RWD 寬螢幕 3/4 欄，加 prop 而非改本卡片
- **`min-h-[36px]` 2 行高保留**：若視覺評審覺得「短標題下方留太多空白」可改 `min-h-0` 但會在 grid 列高度不齊

---

## 8. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-14 | 初版：誤判 ribbon 文字「公益義賣」、用 `bg-alert` 紅 |
| 0.2 | 2026-06-14 | 截圖 IMG_4876 重新判讀：ribbon 文字「**公益標籤**」（列表頁緞帶）/ 「公益義賣 SHOP FOR CHANGE」（詳情頁）；統一 `bg-brand` 替換 `bg-alert`（對齊 003a v0.3 撤回 alert token）；補 `min-h-[36px]` 保 2 行高；補 11 個測試案例；補 a11y 說明 ribbon 不 aria-hidden 的理由 |
