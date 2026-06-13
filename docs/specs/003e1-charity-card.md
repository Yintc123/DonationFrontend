# Spec 003e1：CharityCard

- **狀態**：Draft（v0.1）
- **路徑**：`src/components/ui/CharityCard.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、[002 §3.2 `Charity` schema](./002-list-data.md#3-schemas--srclibschemaslistts)
- **Figma 對應**：IMG_4875（公益團體 tab 卡片）
- **複用性**：中

---

## 1. 職責

公益團體卡片：小 logo（64×64，左）+ 名稱 + 一行簡介（右）。row 排版。整張卡可點擊跳 `/charities/:id`。

---

## 2. Props

```ts
import type { Charity } from '@/lib/schemas/list'

type CharityCardProps = { item: Charity }
```

---

## 3. Anatomy

| 元素 | 規格 |
|---|---|
| Container（`<Link href={`/charities/${item.id}`}>`） | `flex items-center gap-3 w-full max-w-[345px] mx-auto px-3 py-[9px] bg-surface-card rounded-xl hover:bg-black/5` |
| Logo / fallback | `w-16 h-16 rounded-[9px] border border-black/10 object-cover shrink-0` |
| Text column | `flex-1 flex flex-col gap-[3px] min-w-0` |
| Title (`<h2>`) | `text-base font-medium text-ink-AAA leading-6 line-clamp-1` |
| Description | `text-[13px] leading-5 text-ink-AA line-clamp-1` |

骨架同 v0.2 的 `<ResourceCard>`；改名 + 改型別即可。

---

## 4. 變體 / 邊界

- `logoUrl` 缺 / 載入失敗 → fallback（首字母）
- `name` / `description` 超長 → `line-clamp-1`
- 點擊整張卡 → router push 到詳情頁（[spec 004a](./004a-charity-detail.md)）

---

## 5. 測試（colocated `CharityCard.test.tsx`）

- 渲染 name + description
- logoUrl 有 / 無 → 對應 fallback
- logo onError → 切 fallback
- 整張卡是 `<a href="/charities/:id">` 包裝
