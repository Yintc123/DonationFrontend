# Spec 008a：`<BottomSheet>` 通用 modal 基底

- **狀態**：Draft（v0.2 — 加 Portal、補 SSR guard）
- **路徑**：
  - `src/components/ui/BottomSheet.tsx` + `.test.tsx`
- **依賴**：
  - 既有 design system tokens（[003a](./003a-design-system.md)：`bg-surface-card` / `border-line` / `text-ink-*`）
- **使用方**：
  - [008b DonationSettingsSheet](./008b-donation-settings-sheet.md)
  - [008c PurchaseQtySheet](./008c-purchase-qty-sheet.md)
  - 未來其他 modal 需求（filter sheet / share sheet 等）

---

## 1. 職責

通用底部彈出 modal 元件，負責：

- Backdrop（半透明、點擊關閉）
- Panel（圓角頂、向上滑入動畫、捲動限制）
- Header（標題置中 + X close 按鈕）
- 鍵盤 / focus / a11y 機制（focus trap、initial focus、focus return、esc 關閉、scroll lock）
- 退場動畫（避免瞬間消失）

**business form 內容**（捐款設定 / 購買數量）由 caller 透過 children 提供，BottomSheet 本身不知道 caller 是誰、不持任何 form state。

---

## 2. API

```ts
type BottomSheetProps = {
  /** 由 caller 控制；caller 始終把元件放在樹中（見 §5），不要 `{open && <Sheet>}`。 */
  open: boolean
  /** 頂部置中標題；用作 aria-labelledby 的目標。 */
  title: string
  /** X 按鈕 / 背景點擊 / esc 鍵都會觸發。caller 應接收後 `setOpen(false)`。 */
  onClose: () => void
  /** sheet 內容。form 自己管 state、自己渲染 sticky footer button。 */
  children: ReactNode
}
```

---

## 3. Layout

```
┌───────────────────────────────────────┐  ← Backdrop bg-black/30
│         (背景頁面內容可見、變暗)        │
│                                       │
│                                       │
│    ┌─────────────────────────────┐    │  ← Panel
│    │       <title>          X    │    │  ← Header
│    ├─────────────────────────────┤    │
│    │ children (form / list ...)  │    │
│    │ ↕ 內容可滾                   │    │
│    │                             │    │
│    │ [    sticky footer btn    ] │    │  ← children 自己渲染
│    └─────────────────────────────┘    │
└───────────────────────────────────────┘
```

### 3.1 Anatomy / classes

| 元素 | className 重點 |
|---|---|
| Backdrop | `fixed inset-0 bg-black/30 z-40 transition-opacity duration-200` |
| Panel | `fixed inset-x-0 bottom-0 z-50 bg-surface-card rounded-t-2xl max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)] transition-transform duration-200` — `max-h-[85vh]` 保留頂部一小段背景可見；safe-area padding 確保 iOS home indicator 不遮按鈕 |
| Header | `flex items-center justify-between px-5 h-14 border-b border-line` |
| Title | `text-base font-semibold text-ink-AAA`（h2，置中 → `flex-1 text-center` + 左側 24px 空位平衡） |
| X close | `<button aria-label="關閉">` + 24×24 inline SVG（lucide `x` style：兩條對角線、`stroke-currentColor stroke-2`）；mount 時預設 focus 目標 |
| Content | `flex-1 overflow-y-auto px-5 py-4`（children 內可用 `sticky bottom-0` 釘 footer） |

### 3.2 z-index 規範

| 層級 | 元素 |
|---|---|
| `z-30` | caller 端 sticky CTA wrapper（spec 008 §4） |
| `z-40` | BottomSheet backdrop |
| `z-50` | BottomSheet panel |

sheet 開啟時 backdrop 蓋過 caller 的 sticky CTA wrapper，避免使用者誤點。

> 配合 §3.3 Portal：z-index 是 portal target（`<body>`）的 stacking context 內、跟 caller 樹完全隔離，不會被 ancestor 的 `transform` 偷走。

### 3.3 React Portal（v0.2 — must）

BottomSheet **必須**用 `createPortal` 渲染到 `document.body`，**不要**就地渲染在 React 樹中 caller 元件下方。

**為何**：CSS `position: fixed` 在規範裡是「相對 viewport」，**但** 若任何 ancestor 有 `transform / filter / will-change / contain: paint`，會被搶為新的 containing block → sheet 變成「相對該 ancestor」、可能錯位甚至完全跑出可見區。本專案 detail page wrapper 目前沒這些屬性、巧合正常，未來任何一個 parent 加個動畫就會破。

**實作**：

```tsx
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const [alive, setAlive] = useState(open)
  const [mounted, setMounted] = useState(false)  // SSR guard

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (open) setAlive(true)
    else if (alive) {
      const t = setTimeout(() => setAlive(false), SHEET_TRANSITION_MS)
      return () => clearTimeout(t)
    }
  }, [open, alive])

  if (!mounted || !alive) return null   // SSR / 退場後皆不渲染

  const tree = (
    <div role="presentation" className="fixed inset-0 z-40 ..." onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
           className="fixed inset-x-0 bottom-0 z-50 ..."
           onClick={(e) => e.stopPropagation()}>
        {/* header + content */}
      </div>
    </div>
  )
  return createPortal(tree, document.body)
}
```

**SSR guard**：`useEffect(() => setMounted(true), [])` 確保 server-render 階段 (window 不存在) 不呼叫 `createPortal`；客端 hydration 後第二 render 才真正 mount 到 body。避免 Next.js 16 RSC + client hydration 邊界錯誤。

> 為何不用 `'use client'` + `typeof window !== 'undefined' ? createPortal(...) : null`：直接判斷 window 在 React strict mode 會 hydration mismatch（server 渲染 null vs client 第一次渲染 portal）。`mounted` flag 確保 server 與 client 第一次 render 都 null、第二次才差。

---

## 4. 動畫機制（isExiting pattern）

### 4.1 為何不用 `{open && <BottomSheet>}` 或 `key` 換值

兩種模式都會在 open=false 瞬間整棵 unmount，跳過 200ms 退場 transition。要保留動畫**只能**讓 BottomSheet 自己延遲 unmount。

### 4.2 為何不用 `framer-motion` 的 `AnimatePresence`

加 ~30KB dep，本作業除此外無動畫需求，不值。

### 4.3 Reference implementation

完整 reference 已在 §3.3 Portal 範例中體現（含 `alive` mirror state + `mounted` SSR guard + `createPortal`）。常數：

```ts
const SHEET_TRANSITION_MS = 200    // 必須跟 className duration-200 對齊
```

> **為何 200ms timer 而非 `onTransitionEnd`**：transitionend event 在 backdrop opacity / panel transform 會分別 fire、清理時序雜亂；timer 雖不嚴格但簡單、可預測，跟 CSS duration 同步即可。常數 `SHEET_TRANSITION_MS` 必須跟 className 的 `duration-200` 對齊。

---

## 5. Caller 模式

```tsx
// ✅ 正確：始終 mount，靠 BottomSheet 內部 alive state 處理顯隱
<DonationSettingsSheet open={open} onClose={() => setOpen(false)} target={...} />
```

```tsx
// ❌ 不要這樣寫——兩者都會跳過 §4 退場動畫：
{open && <DonationSettingsSheet ... />}
<DonationSettingsSheet key={open ? '1' : '0'} ... />
```

caller 想 reset form state 時，**不要** unmount sheet，改在 sheet body 內 `useEffect(() => { if (open) reset() }, [open])` 顯式重置。詳見 [008b §3.4](./008b-donation-settings-sheet.md) / [008c §3.4](./008c-purchase-qty-sheet.md)。

---

## 6. a11y / 鍵盤

### 6.1 ARIA

- Container：`role="dialog" aria-modal="true" aria-labelledby={titleId}`
- Title `<h2 id={titleId}>` 跟 ARIA 對齊
- X 按鈕：`<button aria-label="關閉">`
- Backdrop：`role="presentation"` + `onClick={onClose}`

### 6.2 Initial focus

開啟時 focus 移到 **X 關閉按鈕**：

```ts
useEffect(() => {
  if (open) closeButtonRef.current?.focus()
}, [open])
```

理由：不誤觸 form control 觸發 input keyboard、對齊 iOS 原生 modal 慣例。

### 6.3 Focus return

**Caller 責任**：sheet 關閉後 focus 還給觸發 sheet 的 CTA 按鈕。`<CtaIsland>`（spec 008 §4）用 `useRef` 抓 button + 在 `onClose` 後 `.focus()`。

BottomSheet 本身不處理 focus return——它不知道是誰開啟它。

### 6.4 Focus trap

選**手寫**（避免引入 `react-focus-lock` dep）：

```ts
useEffect(() => {
  if (!open) return
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusables = panelRef.current!.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [open])
```

**已知限制**：忽略 `tabindex > 0`（罕見）；忽略 sheet 內動態插入的 element（每次 Tab 重新查詢可解、但成本不對等）。本作業 sheet 內 focusable 數 < 10、不動態變動，不處理。

### 6.5 Esc 鍵關閉

```ts
useEffect(() => {
  if (!open) return
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', onEsc)
  return () => document.removeEventListener('keydown', onEsc)
}, [open, onClose])
```

### 6.6 Scroll lock

open 時 body `overflow: hidden`、close 時還原。`useEffect` cleanup 保證 unmount 場景也還原：

```ts
useEffect(() => {
  if (!open) return
  const prev = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  return () => { document.body.style.overflow = prev }
}, [open])
```

### 6.7 Backdrop click 行為

backdrop 點擊 → `onClose()`；panel 點擊**不**該關閉 → panel 加 `onClick={e => e.stopPropagation()}`。

---

## 7. 測試（colocated `BottomSheet.test.tsx`）

| # | 案例 | 期望 |
|---|---|---|
| 1 | open=false → 不渲染 panel（DOM 無 `role="dialog"`） | OK |
| 2 | open=true → 渲染 panel + backdrop + 標題（`role="dialog"` / `aria-modal="true"` / `aria-labelledby`） | OK |
| 3 | 點 X → onClose 被叫 | OK |
| 4 | 點 backdrop → onClose 被叫 | OK |
| 5 | 點 panel 內部 → onClose **不**被叫（stopPropagation） | OK |
| 6 | Esc 鍵 → onClose 被叫 | OK |
| 7 | open=true 時 body overflow=hidden；關閉 / unmount 後還原 | OK |
| 8 | open=true 時 initial focus 在 X 按鈕 | OK |
| 9 | open false → true → 200ms 後 panel 仍 mounted（transition），200ms 後 unmount（isExiting + alive=false） | 用 `vi.useFakeTimers` 測 |
| 10 | portal target：panel 是 `document.body` 的直接 children（不在 caller 樹中） | `document.body.querySelector('[role="dialog"]')` 可找到 |
| 11 | SSR guard：第一次 render 回 null、useEffect 後 mounted=true 才真 portal | hydration 不 mismatch |

---

## 8. 開放問題

- **Drag-to-dismiss**：iOS 原生 sheet 可向下拉關閉；web 上需 touch event + framer-motion 之類。v0.1 不做（X / esc / backdrop 三條 close 路徑已足）
- **多 sheet 同時開**：理論不該發生；信任 caller 不破，不做全域 manager
- **`<dialog>` element 升級**：HTML `<dialog>` + `.showModal()` 原生有 focus trap / esc / backdrop，但動畫控制較弱、瀏覽器支援不一致（iOS Safari 17+ 才完整）。v0.1 用 `<div role="dialog">`，未來 baseline 拉到 iOS 17+ 後評估
- **動畫 timer 不嚴格**：v0.1 用 setTimeout 200ms 對齊 CSS duration，極快點擊 open→close→open 可能讓 alive race。實測不會撞到（typical click latency >> 200ms），未來若 bug 報告再改 transitionend

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-15 | 從 [spec 008 v0.3](./008-donation-checkout-sheets.md) §3.1 抽出獨立 spec：UI primitive 跟 business sheet 分離；補 z-index 階層、focus trap reference、scroll lock cleanup、9 個 unit test case |
| 0.2 | 2026-06-15 | 加 §3.3 **React Portal**（`createPortal(tree, document.body)` + `mounted` SSR guard）：避免 future ancestor `transform / filter` 偷走 `position:fixed` 的 containing block；補 2 個 test case（portal target、SSR guard）|
