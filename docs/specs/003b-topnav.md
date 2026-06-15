# Spec 003b：TopNav

- **狀態**：Draft（v0.3 — 內建 `useSmartBack` default + `fallback?` prop）
- **路徑**：`src/components/ui/TopNav.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、`public/figma/icon-chevron-left.svg`、`next/navigation`（v0.2 新增）
- **Figma 對應**：component `1:32`（`_ Top Navigation - 2`）
- **複用性**：**高** — 純 props（title / onBack? / accessory），無業務字眼；可在所有頁面使用；返回行為內建可用

---

## 1. 職責

紅底白字的頁面頂部導覽列。顯示「返回」+ 標題 + 右側 optional 附件。本作業列表頁只有「返回」與「所有捐款項目」標題；右側 accessory 留 prop 但不接。

返回按鈕**預設**呼叫 `useSmartBack(fallback)`（v0.3）：站內動過 → `router.back()`；首訪 / 外站 / 直接 URL → `router.push(fallback)`（fallback 預設 `/`）。詳見 [spec 005 §4](./005-homepage-auth.md#4-smart-back-navigation) + `src/lib/hooks/useSmartBack.ts`。呼叫端通常不需手動 wire；少數需完全自訂行為（如關閉 modal）可傳 `onBack` 覆寫。

---

## 2. Props

```ts
type TopNavProps = {
  title: string
  /** 自訂返回行為；未傳則用 useSmartBack(fallback)（v0.3） */
  onBack?: () => void
  /** smart back 的 fallback；預設 '/'（spec 005 §3 「回首頁」） */
  fallback?: string
  /** Figma 顯示「紀錄」字樣；本作業不接，但保留型別擴充 */
  accessory?: React.ReactNode
}
```

---

## 3. Anatomy

| 元素 | 規格 |
|---|---|
| Container | `flex items-center w-full h-11 bg-brand px-[14px]` |
| Back button | `<button>` 包 `<img>`；`w-6 h-6`，svg `/figma/icon-chevron-left.svg`（白） |
| Title | `flex-1 text-center text-white text-[17px] font-bold leading-[22px] line-clamp-1` |
| Right accessory slot | `min-w-6` 佔位（無 accessory 時也佔位避免 title 偏移） |

```tsx
'use client'
import { useSmartBack } from '@/lib/hooks/useSmartBack'

export function TopNav({ title, onBack, fallback = '/', accessory }: TopNavProps) {
  const smartBack = useSmartBack(fallback)
  const handleBack = onBack ?? smartBack
  return (
    <header className="flex items-center w-full h-11 bg-brand px-[14px]">
      <button type="button" onClick={handleBack} aria-label="返回" className="w-6 h-6 shrink-0">
        <img src="/figma/icon-chevron-left.svg" alt="" width={24} height={24} />
      </button>
      <h1 className="flex-1 text-center text-white text-[17px] font-bold leading-[22px] line-clamp-1">
        {title}
      </h1>
      <div className="min-w-6 shrink-0">{accessory}</div>
    </header>
  )
}
```

> v0.2：`'use client'` 必須，因元件用 `useRouter`（v0.3 改透過 `useSmartBack`，但仍同樣需 client）。Server Component 仍可渲染 TopNav（Server → Client 跨界 RSC pattern），詳情頁 4 條 page.tsx 不需改。

---

## 4. 互動

| 動作 | 行為 |
|---|---|
| 點返回 | 有 `onBack` → 呼叫 `onBack()`；未傳 → 呼叫 `useSmartBack(fallback)`（v0.3）：站內動過 → `router.back()`；否則 → `router.push(fallback)` |
| 鍵盤 Enter / Space on back | 同點擊（`<button>` 預設） |

---

## 5. 變體

- **無 accessory**：右側佔位 24px，title 仍置中
- **長 title**：`line-clamp-1` 截斷 + 省略號（PingFang 自動 ellipsis）

---

## 6. 狀態

純展示元件，無 loading / error / disabled 狀態。

---

## 7. 測試（colocated `TopNav.test.tsx`）

- 渲染 title 文字
- 按 back button：傳了 `onBack` → 呼叫 `onBack`，**不**走 smart back
- 未傳 `onBack` + 無 `InAppNavProvider` → smart back 走 fallback → `router.push('/')`（預設 fallback；v0.3）
- `fallback` prop 可改變預設目的地（例 `fallback="/donation"`）
- accessory prop 渲染在右側
- header / brand 樣式 / icon alt 等視覺斷言

---

## 8. a11y

- `<header>` semantic
- `<h1>` 標題（頁面只有一個 TopNav）
- back button 有 `aria-label="返回"`
- chevron svg `alt=""`（裝飾性）

---

## 9. 開放問題

- **iOS status bar**：Figma 上面還有狀態列（時間 / 訊號）；瀏覽器渲染時由 browser chrome 負責，本元件不繪
- **背景滑入動效**：頁面切換時要不要從上滑入？目前無；可後續加 framer-motion
- ~~**歷史為空時 `router.back()` 行為**：直接開啟詳情頁 URL 後按返回，瀏覽器歷史為空 → `router.back()` 可能無作用~~ → ✅ v0.3 解決：改用 `useSmartBack`，無 in-app nav 時改 `router.push(fallback)`

---

## 10. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-13 | 初版（onBack 純 prop，未傳時 button 無作用） |
| 0.2 | 2026-06-14 | 改 `'use client'` + `useRouter`，未傳 `onBack` 時預設呼叫 `router.back()`；caller 端不需自己 wire；測試以 `vi.mock('next/navigation')` mock router |
| 0.3 | 2026-06-15 | 預設改 `useSmartBack(fallback)`（[005 §4](./005-homepage-auth.md#4-smart-back-navigation)）：站內動過 → `router.back()`，否則 `router.push(fallback)`（fallback 預設 `/`），解決「直接訪問 / 外站來 / refresh 時返回鈕無作用」的洞；TopNav 多 `fallback?: string` prop；caller 普遍不需動（CharityListShell 移除手動 `onBack={() => router.push('/')}`） |
