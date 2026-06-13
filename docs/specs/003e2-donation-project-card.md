# Spec 003e2：DonationProjectCard

- **狀態**：Draft（v0.1 — 截圖補件揭露 layout）
- **路徑**：`src/components/ui/DonationProjectCard.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、[002 §3.2 `Donation` schema](./002-list-data.md#3-schemas--srclibschemaslistts)
- **Figma 對應**：IMG_4880（捐款專案 tab 卡片）
- **複用性**：中

---

## 1. 職責

捐款專案卡片：寬幅 cover image（top）+ 主辦團體名 / categories tag bar（中）+ 標題 + 描述（bottom）+ categories tag pill。整張卡可點跳 `/donation-projects/:id`。

---

## 2. Props

```ts
import type { Donation } from '@/lib/schemas/list'

type DonationProjectCardProps = { item: Donation }
```

`Donation` shape（spec 002 §3.2）：

```ts
{
  id, name, description, logoUrl?,
  charityId, charityName,
  coverImageUrl?,
  categories?: CategoryKey[],
}
```

---

## 3. Anatomy

對齊 IMG_4880。

| 元素 | 規格 |
|---|---|
| Container（`<Link>` 包整張） | `flex flex-col w-full max-w-[345px] mx-auto bg-surface-card rounded-xl overflow-hidden shadow-sm hover:shadow-md` |
| Cover image | `w-full aspect-[16/9] object-cover` |
| Cover image fallback | 同尺寸 `bg-gray-200` + 中央 icon（建議用 `<HeartIcon>`） |
| Charity name label（藍色 banner） | `px-3 py-1 bg-brand-soft text-ink-AAA text-[13px] truncate` |
| Title (`<h2>`) | `px-3 pt-2 text-base font-semibold text-ink-AAA leading-6 line-clamp-1` |
| Description | `px-3 pb-2 text-[13px] leading-5 text-ink-AA line-clamp-2` |
| Categories tag bar | `flex flex-wrap gap-1 px-3 pb-3` |
| Each category pill | `px-2 py-[2px] rounded-full bg-black/5 text-[12px] text-ink-AA`（對齊 003a §2 統一灰底 token） |

---

## 4. 變體 / 邊界

- `coverImageUrl` 缺 → fallback bg
- `coverImageUrl` 載入失敗 → onError → fallback
- `categories` 為 0 / undefined → tag bar 不渲染（不留空白）
- `categories` 超過 3 個 → 顯示前 3 + `+N`
- `name` 超長 → `line-clamp-1`
- `description` 超長 → `line-clamp-2`

---

## 5. 測試（colocated）

- 渲染 cover / 主辦團體名 / 標題 / 描述 / categories tags
- coverImageUrl 缺 → fallback
- categories > 3 → 顯示 +N
- 整張卡為 `<a href="/donation-projects/:id">` 包裝

---

## 6. 開放問題

- 標題上方那條淺色 banner（IMG_4880 帶有「財團法人宜蘭縣私立柏拉圖復康之家」字樣）顏色未明，先用 `bg-brand-soft`；若 Figma 確切是漸層，後補
- cover image aspect ratio：IMG_4880 約 16:9，未來若多尺寸可加 prop
