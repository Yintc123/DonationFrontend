# Spec 003m：CategoryMenu（bottom-sheet modal）

- **狀態**：Draft（v0.8 — sheet 加 RWD 限寬置中：`md+` 限寬 480 + horizontal centering wrapper；對齊 [003a §5.3](./003a-design-system.md#53-categorymenu-sheet)）
- **路徑**：`src/components/ui/CategoryMenu.tsx`
- **依賴**：
  - [003a Design System](./003a-design-system.md)
  - [003k FilterButton](./003k-filter-button.md)（trigger）
  - [002 §3.1 CategoryKey + CATEGORY_LABELS](./002-list-data.md#3-schemas--srclibschemaslistts)（16 個 categories 來源）
- **Figma 對應**：IMG_4877 / IMG_4879 / IMG_4880（**bottom-sheet modal**，三個 tab 開啟形態）
- **複用性**：中 — 結構為「全屏 modal + grid of options + 選中態」，泛化成 `<BottomSheetGrid />` 可用於其他多選場景

---

## 1. 職責

點 FilterButton 後**從畫面底部滑入**（v0.6 加動畫）的 bottom-sheet modal。包含：
- 標題列「選擇類別」+ 右上 `X` 關閉
- **3 欄 grid**，共 17 個按鈕：「全部」+ 16 個 categories（[002 §3.1](./002-list-data.md)）
- 選中 option 帶 **紅框 outline**（無 check icon，視覺對齊 IMG_4879）
- 點任一 option → onSelect → 自動關閉

關閉路徑：右上 X、按 Esc、點 backdrop 區域。

> v0.3 → v0.4：截圖揭露為 bottom-sheet 而非 dropdown。前端框架 / a11y / focus 流程整個改寫。

---

## 2. Props

```ts
import type { CategoryKey } from '@/lib/schemas/categories'

type CategoryMenuProps = {
  isOpen: boolean
  selectedCategory: CategoryKey | null   // null = 「全部」
  onSelect: (next: CategoryKey | null) => void
  onClose: () => void
}
```

API 同 v0.3；視覺實作改變。

---

## 3. Anatomy

對齊 IMG_4879 / IMG_4881。

| 元素 | 規格 |
|---|---|
| Backdrop | `fixed inset-0 bg-black/40 z-40`；open 套 `animate-fade-in-bg`、close 套 `animate-fade-out-bg`；點擊 → `onClose()` |
| Sheet 外層 wrapper（v0.8 新增） | `fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none`；負責 horizontal centering（不影響 sheet 自己的 translateY 動畫 transform） |
| Sheet container `<section>` | `pointer-events-auto w-full md:max-w-[480px] bg-surface-card rounded-t-2xl md:rounded-2xl md:mb-6 shadow-2xl pb-[env(safe-area-inset-bottom)]`；open 套 `animate-slide-up-enter`、close 套 `animate-slide-down-exit`；綁 `onAnimationEnd` 偵測 `slide-down-exit` 結束才 unmount |
| Header | `relative flex items-center justify-center px-4 py-4 border-b border-line-soft` |
| Header title | `text-base font-medium text-ink-AAA` 「選擇類別」 |
| Close button (右上) | `absolute right-3 top-3 w-8 h-8 flex items-center justify-center text-ink-AA` + `focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand rounded`（icon `X`） |
| Grid container（`role="radiogroup"`） | `grid grid-cols-3 gap-3 px-4 py-4` |
| Option button | `h-11 rounded-md border text-sm leading-tight px-2 flex items-center justify-center text-center` + `focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand` |
| Option（unselected） | `border-line text-ink-AA bg-surface-card` |
| Option（selected） | `border-brand text-brand bg-surface-card`（**紅框 outline + 紅字**，對齊 IMG_4877「全部」選中態） |

> v0.5 token 收斂：原 `border-gray-200` → `border-line`（003a v0.3）；`border-red-500` / `text-red-500` → `border-brand` / `text-brand`（003a v0.3 撤回 alert，紅色統一 brand）；`border-gray-100` → `border-line-soft`；`bg-white` → `bg-surface-card`。

### 3.1 動畫機制（v0.7 改 CSS keyframes）

slide-in/out 用 **CSS `@keyframes` + `onAnimationEnd`** 控，**不**用 React state 觸發 transition。

**為什麼不用 v0.6 的 transition + 2-state pattern**：v0.6 設計上對，但 React 19 把 `setShouldRender(true)` 跟 rAF 內的 `setIsVisible(true)` batch 成同一 commit、首次 paint 就在終態 → slide-in 不會動（看起來突然出現）。雙 rAF / `flushSync` 都不保證跨 browser/React 版本穩定。**keyframes 不依賴多次 commit**，從 mount 那一刻 CSS 自己跑、沒 batching 風險。

**keyframes 定義在 `globals.css`**：

```css
@theme {
  --animate-slide-up-enter: slide-up-enter 300ms ease-out both;
  --animate-slide-down-exit: slide-down-exit 300ms ease-out both;
  --animate-fade-in-bg: fade-in-bg 300ms ease-out both;
  --animate-fade-out-bg: fade-out-bg 300ms ease-out both;
}
@keyframes slide-up-enter   { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes slide-down-exit  { from { transform: translateY(0); }   to { transform: translateY(100%); } }
@keyframes fade-in-bg       { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-out-bg      { from { opacity: 1; } to { opacity: 0; } }
```

`both` 鎖定 keyframe 起點 + 終點：exit keyframe 結束後元素停在 `translate-y-full`，視覺對齊「滑出畫面後消失」。

**元件層只需 1 state + onAnimationEnd**：

```tsx
const [shouldRender, setShouldRender] = useState(isOpen)
useEffect(() => { if (isOpen) setShouldRender(true) }, [isOpen])

const onAnimEnd = (e: React.AnimationEvent) => {
  if (!isOpen && e.animationName === 'slide-down-exit') setShouldRender(false)
}

if (!shouldRender) return null
return (
  <div role="dialog" ...>
    <button className={isOpen ? 'animate-fade-in-bg' : 'animate-fade-out-bg'} ... />
    <section
      onAnimationEnd={onAnimEnd}
      className={isOpen ? 'animate-slide-up-enter' : 'animate-slide-down-exit'}
    >
      ...
    </section>
  </div>
)
```

**為什麼 onAnimationEnd 只認 `slide-down-exit`**：
- backdrop 的 fade-out 也會 fire 一次 animationend
- 進場 slide-up-enter 結束也會 fire
- 漏判任一個都會在錯的時機 unmount。比對 `animationName` 精準鎖定 exit。

**為什麼 Esc / scroll lock 綁 `isOpen` 而非 `shouldRender`**（同 v0.6）：close 後鍵盤 + scroll 立即交還使用者；sheet 退出動畫進行中再按 Esc 也不該重觸 onClose。

**Animation timing**：
- duration 300ms — 對應 Tailwind `duration-300`、Material Design 「standard easing」短時長
- ease-out — 入場慢入快出較自然
- prefers-reduced-motion: `globals.css` `@media` 把 duration 強壓 `1ms`（不是 `animation: none`）— 視覺無感但 `animationend` 仍 fire，unmount 邏輯不會卡

```tsx
'use client'
import { useEffect } from 'react'
import type { CategoryKey } from '@/lib/schemas/categories'
import { CATEGORY_LABELS, CATEGORY_KEYS } from '@/lib/schemas/categories'

const OPTIONS: { value: CategoryKey | null; label: string }[] = [
  { value: null, label: '全部' },
  ...CATEGORY_KEYS.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
]

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  )
}

export function CategoryMenu({
  isOpen, selectedCategory, onSelect, onClose,
}: CategoryMenuProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // body scroll lock
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="category-sheet-title">
      <button
        type="button"
        aria-label="關閉選單"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 cursor-default"
      />
      <section
        className="fixed inset-x-0 bottom-0 z-50 bg-surface-card rounded-t-2xl
                   shadow-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <header className="relative flex items-center justify-center px-4 py-4 border-b border-line-soft">
          <h2 id="category-sheet-title" className="text-base font-medium text-ink-AAA">
            選擇類別
          </h2>
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center
                       text-ink-AA focus-visible:outline focus-visible:outline-2
                       focus-visible:outline-brand rounded"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>
        <div
          role="radiogroup"
          aria-labelledby="category-sheet-title"
          className="grid grid-cols-3 gap-3 px-4 py-4"
        >
          {OPTIONS.map((opt) => {
            const isSelected = opt.value === selectedCategory
            const key = opt.value ?? '__all__'
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => { onSelect(opt.value); onClose() }}
                className={`h-11 rounded-md border text-sm px-2 flex items-center justify-center text-center
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand
                  ${isSelected
                    ? 'border-brand text-brand bg-surface-card'
                    : 'border-line text-ink-AA bg-surface-card'}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
```

> Sheet 用 `fixed bottom-0` + grid；不做 slide-up 動畫（v0.4 keep simple，未來可加 framer-motion）。
> body scroll lock：開啟時禁背景滑動，關閉時 restore。

---

## 4. 互動

| 動作 | 行為 |
|---|---|
| 點 option | `onSelect(value)` → `onClose()` |
| 點 X | `onClose()` |
| 點 backdrop | `onClose()` |
| Esc | `onClose()` |
| Tab / Shift+Tab | 預設 button 焦點 trap 在 sheet 內（簡化版：不主動 trap，由 user 體驗） |

---

## 5. 變體

| 條件 | 呈現 |
|---|---|
| `isOpen=false` | `return null` |
| `selectedCategory=null` | 「全部」option 紅框紅字 |
| `selectedCategory='animal_protection'` | 「動物保護」option 紅框紅字 |

---

## 6. 測試（colocated `CategoryMenu.test.tsx`）

- `isOpen=false` → 不渲染 dialog
- `isOpen=true` → 渲染 17 個 option（「全部」+ 16 categories；對齊 [002 §3.1 CATEGORY_KEYS](./002-list-data.md#3-schemas--srclibschemaslistts)）
- 17 個 option 順序：第一個是「全部」，其後依 `CATEGORY_KEYS` 陣列順序展開
- `selectedCategory=null` → 「全部」option `aria-checked=true` 且 className 含 `border-brand text-brand`
- `selectedCategory='animal_protection'` → 「動物保護」option `aria-checked=true` 且 className 含 `border-brand text-brand`
- 點 option → `onSelect(value)` + `onClose()` 各被呼叫一次
- 點 X → onClose；不觸 onSelect
- 點 backdrop → onClose
- Esc → onClose
- `isOpen=false` 時 → 不註冊 keydown listener
- 開啟時 `document.body.style.overflow === 'hidden'`；關閉後 restore
- ARIA：外層 `role="dialog" aria-modal="true" aria-labelledby="category-sheet-title"`；grid 外層 `role="radiogroup"`；每個 option `role="radio"`
- 動畫（v0.7 改 keyframes 後 4 案例）：
  - open 時 sheet 套 `animate-slide-up-enter`、backdrop 套 `animate-fade-in-bg`
  - close 後 sheet 切到 `animate-slide-down-exit`、backdrop 切到 `animate-fade-out-bg`，仍在 DOM
  - `fireEvent.animationEnd(section, { animationName: 'slide-down-exit' })` → 才 unmount；其他 animationName 不會誤 unmount
  - `isOpen=true` 時觸 `slide-up-enter` 結束 → 不會誤 unmount

---

## 7. a11y

- `role="dialog" aria-modal="true" aria-labelledby="category-sheet-title"`
- 17 個 options 用 `role="radio"` + `aria-checked`（grid 外層 `role="radiogroup" aria-labelledby="category-sheet-title"`）
- Backdrop button 有 `aria-label="關閉選單"`
- 開啟時 body scroll lock；關閉 restore
- focus trap：簡化不做完整 trap；用 Tab 在 sheet 內 button 之間循環
- ARIA pair：trigger（[003k FilterButton](./003k-filter-button.md)）的 `aria-haspopup="dialog"` 與本元件 `role="dialog"` 對齊（v0.5 系統性修正）

---

## 8. 開放問題

- **完整 focus trap**：W3C dialog pattern 應該打開時 focus 第一個可互動元素、Tab 循環 trap 在 dialog 內；v0.4 簡化，未來用 `@radix-ui/react-dialog` 或 `focus-trap-react`
- ~~**動畫**：v0.4 即時切換，無 slide-up；視 demo 觀感再加~~ — **v0.6 已加** slide-up + opacity 雙動畫
- **「全部」位置**：截圖紅框示意「全部」在 grid 第一格；本 spec 對齊
- **桌面版**：bottom-sheet 在桌面看起來奇怪，可考慮 width 收斂到 `max-w-[480px]` 對齊主容器，或桌面切回 dropdown（暫不做，本作業 mobile-first）
- **drag-to-dismiss**：iOS 原生 bottom-sheet 支援下拉關閉；本 spec 不做（需引手勢 lib 如 `@use-gesture/react`）

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1-0.3 | 2026-06-13 ~ 14 | 原 dropdown 設計（anchor 在 FilterButton 下方） |
| 0.4 | 2026-06-14 | 截圖補件 IMG_4879 / 4881：改 **bottom-sheet modal**（3 欄 grid + 紅框選中態 + X 關閉 + backdrop click + Esc + body scroll lock）；categories 6 → 17 options（全部 + 16） |
| 0.5 | 2026-06-14 | token 收斂對齊 [003a v0.3](./003a-design-system.md#9-變更紀錄)：`border-gray-200` → `border-line`、`border-gray-100` → `border-line-soft`、`border-red-500` / `text-red-500` → `border-brand` / `text-brand`、`bg-white` → `bg-surface-card`；ARIA pair：與 [003k v0.4](./003k-filter-button.md#10-變更紀錄) `aria-haspopup="dialog"` 對齊；grid 外層補 `role="radiogroup" aria-labelledby`；option / X 按鈕補 `focus-visible:outline-brand` |
| 0.6 | 2026-06-14 | 加 slide-in/out 動畫（sheet `translate-y-full ↔ translate-y-0`、backdrop `opacity 0 ↔ 100`、duration 300ms ease-out）；2-state pattern (`shouldRender` / `isVisible`) 配 rAF + setTimeout 達成「mount-then-animate-in」與「animate-out-then-unmount」；Esc / scroll lock 仍綁 `isOpen`（不綁 `shouldRender`）；補 `motion-reduce:transition-none` 安全網；補 3 個動畫測試 |
| 0.7 | 2026-06-14 | 修 v0.6 slide-in 觀感 bug：React 19 把 `setShouldRender(true)` 與 rAF 內 `setIsVisible(true)` batch 成單 commit、首次 paint 在終態 → 看起來突然出現。改用純 CSS `@keyframes`（globals.css 加 4 個 keyframes + animate-\* token）配 `onAnimationEnd` 控 unmount；1 state 設計、不依賴 React 多 commit；motion-reduce 改 `animation-duration: 1ms` 確保 animationend 仍 fire；測試從 3 案例擴為 4 案例（涵蓋 animationName 精準比對 + 進場誤 unmount 防呆） |
| 0.8 | 2026-06-14 | RWD 限寬：md+ sheet `max-w-[480px]` + horizontal centering、`md:rounded-2xl md:mb-6` 帶底距。新加 wrapper `<div fixed inset-x-0 bottom-0 flex justify-center pointer-events-none>` 處理 centering，sheet 仍綁 translateY 動畫 transform 不衝突。對齊 [003a §5.3](./003a-design-system.md#53-categorymenu-sheet) |
