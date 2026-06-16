# Spec 003b：TopNav

- **狀態**：Draft（v0.5 — `backHref` prop：top-level landing 頁強制返回到固定路徑、繞過 useSmartBack）
- **路徑**：`src/components/ui/TopNav.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、`public/figma/icon-chevron-left.svg`、`next/navigation`（v0.2 新增）
- **Figma 對應**：component `1:32`（`_ Top Navigation - 2`）
- **複用性**：**高** — 純 props（title / onBack? / accessory），無業務字眼；可在所有頁面使用；返回行為內建可用

---

## 1. 職責

紅底白字的頁面頂部導覽列。顯示「返回」+ 標題 + 右側 optional 附件。本作業列表頁只有「返回」與「所有捐款項目」標題；右側 accessory 留 prop 但不接。

返回按鈕**預設**呼叫 `useSmartBack(fallback)`（v0.3）：站內動過 → `router.back()`；首訪 / 外站 / 直接 URL → `router.push(fallback)`（fallback 預設 `/`）。詳見 [spec 005 §4](./005-homepage-auth.md#4-smart-back-navigation) + `src/lib/hooks/useSmartBack.ts`。呼叫端通常不需手動 wire；少數需完全自訂行為（如關閉 modal）可傳 `onBack` 覆寫。

**v0.5 新增 `backHref` prop**：給 top-level landing 頁（目前 `/donation`、`/cms`）用，**強制**返回到指定路徑、無視 useSmartBack 的 history 判斷。這些頁面語意上「返回 = 回首頁」、不該依賴使用者從哪裡來（例：從 `/cms` 進 `/donation` 時 smart-back 會回 `/cms` 反而違反「回首頁」的預期）。優先級：`onBack` > `backHref` > smart-back。

---

## 2. Props

```ts
type TopNavProps = {
  title: string
  /** 自訂返回行為；未傳則用 useSmartBack(fallback)（v0.3） */
  onBack?: () => void
  /** smart back 的 fallback；預設 '/'（spec 005 §3 「回首頁」） */
  fallback?: string
  /** v0.5 — 設了就無視 smart-back，always router.push(backHref) */
  backHref?: string
  /** Figma 顯示「紀錄」字樣；本作業不接，但保留型別擴充 */
  accessory?: React.ReactNode
}
```

---

## 3. Anatomy

| 元素 | 規格 |
|---|---|
| Container | `sticky top-0 z-30 flex items-center w-full h-11 bg-brand px-[14px] pt-[env(safe-area-inset-top)]`（v0.4 — sticky 黏在 viewport 頂端 + iOS 瀏海安全區 padding） |
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
    <header
      className="sticky top-0 z-30 flex items-center w-full h-11
                 bg-brand px-[14px] pt-[env(safe-area-inset-top)]"
    >
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

### 3.1 Sticky 設計（v0.4）

| 議題 | 決策 |
|---|---|
| **position 選擇** | `sticky top-0`，不用 `fixed`。sticky 留在 normal flow，不需要在 caller 端補 `pt-11` 留空間；只有頁面實際 scroll 時才開始黏住 |
| **z-index** | `z-30`，跟既有 [008a §3.2](./008a-bottom-sheet.md#32-z-index-規範) sticky 底部 CTA wrapper 同層 — chrome 層（page 上下兩端）統一在 modal backdrop `z-40` 之下；BottomSheet 開啟時 backdrop 蓋過 TopNav（避免使用者在 modal 開著時誤點返回） |
| **scroll context** | `<body>` 是 `min-h-dvh flex flex-col`、無 `overflow`，所以 sticky scope 到 viewport；所有 TopNav 用例（list shell / detail page / confirm shell）的中間包裝層也沒設 `overflow / transform / contain: paint`，不會搶 containing block |
| **safe-area-inset-top** | iOS 瀏海 / Dynamic Island 機型 `env(safe-area-inset-top)` > 0；用 `pt-[env(safe-area-inset-top)]` 把安全區塞進 header 自己的 padding 內，避免內容跑進瀏海下方。content 區仍 `h-11`，整條 bar 在非瀏海設備不增高 |
| **caller 不需補 spacer** | sticky 是 in-flow，下方內容自然從 header 下方接續；不要在 caller 端加 `mt-11` / `pt-11`，會造成多餘空白 |
| **TabsRow / SearchBar / FilterRow 是否一起 sticky** | 暫不一起，避免堆疊太多固定 chrome 占螢幕。v0.1 僅 TopNav；未來若 PM 要求「列表頁切 tab 永遠可見」再評估，需重新分配 z-index |

---

## 4. 互動

| 動作 | 行為 |
|---|---|
| 點返回 | 優先級 `onBack > backHref > smart-back`：(a) 有 `onBack` → `onBack()`；(b) 有 `backHref`（v0.5）→ `router.push(backHref)`；(c) 都未傳 → `useSmartBack(fallback)`：站內動過 → `router.back()`；否則 → `router.push(fallback)` |
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
- `backHref` 設了 → 即使「站內已動過」（mock `useHasInAppNavigated → true`）仍 `router.push(backHref)`，**不**走 `router.back()`（v0.5）
- `onBack` 優先於 `backHref`（escape hatch；v0.5）
- accessory prop 渲染在右側
- header / brand 樣式 / icon alt 等視覺斷言
- **sticky top-0 z-30**（v0.4）— 確保 className 含 `sticky` / `top-0` / `z-30`，避免日後誤刪

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
- **長列表的 chrome 雙層 sticky**：目前只 TopNav sticky，TabsRow / SearchBar / FilterRow 不 sticky。若 PM 要求列表頁切 tab / 篩選器永遠可見，需把 chrome rows 也 sticky 並重新分配 z-index（建議 TopNav z-30、chrome rows z-20、卡片 z-0）。未做 — 避免占螢幕
- ~~**歷史為空時 `router.back()` 行為**：直接開啟詳情頁 URL 後按返回，瀏覽器歷史為空 → `router.back()` 可能無作用~~ → ✅ v0.3 解決：改用 `useSmartBack`，無 in-app nav 時改 `router.push(fallback)`

---

## 10. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-13 | 初版（onBack 純 prop，未傳時 button 無作用） |
| 0.2 | 2026-06-14 | 改 `'use client'` + `useRouter`，未傳 `onBack` 時預設呼叫 `router.back()`；caller 端不需自己 wire；測試以 `vi.mock('next/navigation')` mock router |
| 0.3 | 2026-06-15 | 預設改 `useSmartBack(fallback)`（[005 §4](./005-homepage-auth.md#4-smart-back-navigation)）：站內動過 → `router.back()`，否則 `router.push(fallback)`（fallback 預設 `/`），解決「直接訪問 / 外站來 / refresh 時返回鈕無作用」的洞；TopNav 多 `fallback?: string` prop；caller 普遍不需動（CharityListShell 移除手動 `onBack={() => router.push('/')}`） |
| 0.4 | 2026-06-15 | **Sticky top**：header 加 `sticky top-0 z-30 pt-[env(safe-area-inset-top)]`。z-30 與既有 sticky 底部 CTA wrapper（[008a §3.2](./008a-bottom-sheet.md#32-z-index-規範)）同層、低於 BottomSheet backdrop `z-40`（modal 開啟時遮 TopNav，避免誤點返回）。caller 不需補 `mt-11` — sticky 留在 normal flow。新增 §3.1 sticky 設計表細解 position / z-index / scroll context / safe-area / TabsRow 不一起 sticky 的取捨。`TopNav.test.tsx` 新增「sticky top-0 z-30」className 斷言 |
| 0.5 | 2026-06-16 | **`backHref?: string` prop**：給 top-level landing 頁強制「返回 = 固定路徑」、繞過 useSmartBack 的 history 判斷。觸發場景：從 `/cms` 進 `/donation`，smart-back 會 `router.back()` 回 `/cms`，違反「`/donation` 是頂層、返回 = 回首頁」的語意。優先級 `onBack > backHref > smart-back`（onBack 是 escape hatch）。套用範圍：`/donation` CharityListShell + `/cms` page.tsx（同時把 `/cms` 自製 placeholder header 換成 `<TopNav title="後台" backHref="/" />`，補上原本缺的返回鈕）。Test 新增 2 個 case：「mock useHasInAppNavigated=true 時 backHref 仍 push」+「onBack 優先於 backHref」 |
