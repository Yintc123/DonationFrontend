# Spec 003e3：SaleItemCard

- **狀態**：Draft（v0.1 — 截圖補件揭露 layout）
- **路徑**：`src/components/ui/SaleItemCard.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、[002 §3.2 `Item` schema](./002-list-data.md#3-schemas--srclibschemaslistts)
- **Figma 對應**：IMG_4877（義賣商品 tab 卡片）
- **複用性**：中

---

## 1. 職責

義賣商品卡片：商品圖（top）+「公益義賣」絲帶 ribbon banner（左上 overlay）+ 商品名 + 主辦團體名 + **TWD 價格**（紅色加重）。卡片排版為 2 欄 grid（spec 003i Shell layout）。整張卡可點跳 `/sale-items/:id`。

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
  priceTwd: number,            // 必有
  categories?: CategoryKey[],
}
```

> `priceTwd` 為整數 TWD，無小數。展示時用 `Intl.NumberFormat('zh-TW')` 加千分位。

---

## 3. Anatomy

對齊 IMG_4877。

| 元素 | 規格 |
|---|---|
| Container（`<Link>` 包整張） | `flex flex-col w-full bg-surface-card rounded-xl overflow-hidden border border-black/5 hover:shadow-md` |
| Image wrap | `relative aspect-square` |
| Cover image | `w-full h-full object-cover` |
| Ribbon banner（左上 overlay） | `absolute top-2 left-0 px-2 py-[2px] bg-alert text-white text-[11px] rounded-r-md shadow-sm`；文字「公益義賣」 |
| Body | `flex flex-col gap-1 px-2 py-2` |
| Title (`<h2>`) | `text-[13px] font-medium text-ink-AAA leading-[18px] line-clamp-2` |
| Charity name | `text-[11px] text-ink-AA line-clamp-1` |
| Price | `text-base font-bold text-alert leading-6`；格式 `TWD {Intl 千分位}` |

> 義賣商品的卡片在 IMG_4877 是 **2 欄 grid 排版**（每行 2 張）。grid container 由 [003j ResourceInfiniteList](./003j-charity-list.md) 為 `resource === 'item'` 時切換 layout（`grid grid-cols-2 gap-2`），charity / donation 維持單欄 stack。

---

## 4. 變體 / 邊界

- `coverImageUrl` 缺 → fallback bg
- `coverImageUrl` 載入失敗 → onError → fallback
- `priceTwd === 0` → 顯示「TWD 0」（不擋）
- `name` 超長 → `line-clamp-2`
- `categories` 在卡片**不顯示**（節省空間，IMG_4877 卡片無 tags；categories tags 移到詳情頁 [004c](./004c-sale-item-detail.md)）

---

## 5. 測試（colocated）

- 渲染商品圖 / ribbon「公益義賣」 / 商品名 / 主辦團體名 / 價格
- 價格格式：`TWD 1,330`（千分位）
- coverImageUrl 缺 → fallback
- 整張卡為 `<a href="/sale-items/:id">` 包裝

---

## 6. 開放問題

- Ribbon 文字「公益義賣」是否加 `SHOP FOR CHANGE` 英文副標（IMG_4882 詳情頁有，列表頁卡片無 → 列表頁先不加）
- 卡片 2 欄 grid 是 layout 切換，由 ResourceInfiniteList 處理；若未來要做 RWD 寬螢幕 3/4 欄，加 prop
