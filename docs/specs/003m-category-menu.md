# Spec 003m：CategoryMenu（bottom-sheet modal）

- **狀態**：Draft（v0.4 — 截圖補件後從 dropdown 改 bottom-sheet modal；categories 6 → 17）
- **路徑**：`src/components/ui/CategoryMenu.tsx`
- **依賴**：
  - [003a Design System](./003a-design-system.md)
  - [003k FilterButton](./003k-filter-button.md)（trigger）
  - [002 §3.1 CategoryKey + CATEGORY_LABELS](./002-list-data.md#3-schemas--srclibschemaslistts)（16 個 categories 來源）
- **Figma 對應**：IMG_4879、IMG_4881（**bottom-sheet modal**）
- **複用性**：中 — 結構為「全屏 modal + grid of options + 選中態」，泛化成 `<BottomSheetGrid />` 可用於其他多選場景

---

## 1. 職責

點 FilterButton 後從畫面底部滑上的 **bottom-sheet modal**。包含：
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
| Backdrop | `fixed inset-0 bg-black/40 z-40`；點擊 → `onClose()` |
| Sheet container | `fixed inset-x-0 bottom-0 z-50 bg-surface-card rounded-t-2xl shadow-2xl pb-safe`（行動裝置 safe-area） |
| Header | `relative flex items-center justify-center px-4 py-4 border-b border-gray-100` |
| Header title | `text-base font-medium text-ink-AAA` 「選擇類別」 |
| Close button (右上) | `absolute right-3 top-3 w-8 h-8 flex items-center justify-center text-ink-AA`（icon `X`） |
| Grid container | `grid grid-cols-3 gap-3 px-4 py-4` |
| Option button | `h-11 rounded-md border text-sm leading-tight px-2 flex items-center justify-center text-center` |
| Option（unselected） | `border-gray-200 text-ink-AA bg-white` |
| Option（selected） | `border-red-500 text-red-500 bg-white`（**紅框 outline**，IMG_4879「全部」選中態） |

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
        <header className="relative flex items-center justify-center px-4 py-4 border-b border-gray-100">
          <h2 id="category-sheet-title" className="text-base font-medium text-ink-AAA">
            選擇類別
          </h2>
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center text-ink-AA"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>
        <div className="grid grid-cols-3 gap-3 px-4 py-4">
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
                  ${isSelected
                    ? 'border-red-500 text-red-500 bg-white'
                    : 'border-gray-200 text-ink-AA bg-white'}`}
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
| `selectedCategory=null` | 「全部」option 紅框 |
| `selectedCategory='animal_protection'` | 「動物保護」option 紅框 |

---

## 6. 測試（colocated `CategoryMenu.test.tsx`）

- `isOpen=false` → 不渲染 dialog
- `isOpen=true` → 渲染 17 個 option（全部 + 16 categories）
- `selectedCategory=null` → 「全部」option `aria-checked=true` 且帶紅框
- `selectedCategory='animal_protection'` → 「動物保護」紅框
- 點 option → onSelect + onClose 被呼叫
- 點 X → onClose；不觸 onSelect
- 點 backdrop → onClose
- Esc → onClose
- `isOpen=false` 時 → 不註冊 keydown listener
- 開啟時 `document.body.style.overflow === 'hidden'`；關閉後 restore

---

## 7. a11y

- `role="dialog" aria-modal="true" aria-labelledby="category-sheet-title"`
- 17 個 options 用 `role="radio"` + `aria-checked`（單選性質，外層可加 `role="radiogroup"`）
- Backdrop button 有 `aria-label="關閉選單"`
- 開啟時 body scroll lock；關閉 restore
- focus trap：簡化不做完整 trap；用 Tab 在 sheet 內 button 之間循環

---

## 8. 開放問題

- **完整 focus trap**：W3C dialog pattern 應該打開時 focus 第一個可互動元素、Tab 循環 trap 在 dialog 內；v0.4 簡化，未來用 `@radix-ui/react-dialog` 或 `focus-trap-react`
- **動畫**：v0.4 即時切換，無 slide-up；視 demo 觀感再加
- **「全部」位置**：截圖紅框示意「全部」在 grid 第一格；本 spec 對齊
- **桌面版**：bottom-sheet 在桌面看起來奇怪，可考慮 width 收斂到 `max-w-[480px]` 對齊主容器，或桌面切回 dropdown（暫不做，本作業 mobile-first）

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1-0.3 | 2026-06-13 ~ 14 | 原 dropdown 設計（anchor 在 FilterButton 下方） |
| 0.4 | 2026-06-14 | 截圖補件 IMG_4879 / 4881：改 **bottom-sheet modal**（3 欄 grid + 紅框選中態 + X 關閉 + backdrop click + Esc + body scroll lock）；categories 6 → 17 options（全部 + 16） |
