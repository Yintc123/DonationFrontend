# Spec 003l：BrandFooter

- **狀態**：Draft（v0.2 — Figma 對齊補件）
- **路徑**：`src/components/ui/BrandFooter.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)
- **Figma 對應**：frame `1:2354`（`text` wrapper）+ inner text node `1:2355`「愛心沒有底線」，兩側 Vector 4 / Vector 5（1px stroke `palette/black/20`）
- **複用性**：**高** — 純 props（label + 顏色）；可在任何頁面底部用做品牌標語

---

## 1. 職責

頁面底部品牌標語，文字「愛心沒有底線」+ 兩側橫線。Figma 顯示為「**─── 愛心沒有底線 ───**」風格。

---

## 2. Props

```ts
type BrandFooterProps = {
  label?: string  // 預設 '愛心沒有底線'
}
```

---

## 3. Anatomy

| 元素 | 規格 |
|---|---|
| Container | `flex items-center justify-center gap-3 py-5 px-[15px]` |
| 左 / 右橫線 | `flex-1 h-px bg-black/20 max-w-[80px]` |
| Label | `text-[13px] leading-5 text-black/20 px-2 whitespace-nowrap` |

Figma 細節對映：

| Figma | Tailwind |
|---|---|
| Text style `ios/p3` 13/20 regular | `text-[13px] leading-5` |
| Text fill `palette/black/20` | `text-black/20` |
| Vector strokes `palette/black/20` 1px | `bg-black/20 h-px` |

```tsx
export function BrandFooter({ label = '愛心沒有底線' }: BrandFooterProps) {
  return (
    <footer className="flex items-center justify-center gap-3 py-5 px-[15px]" aria-label="品牌標語">
      <span className="flex-1 h-px bg-black/20 max-w-[80px]" aria-hidden />
      <span className="text-[13px] leading-5 text-black/20 whitespace-nowrap">
        {label}
      </span>
      <span className="flex-1 h-px bg-black/20 max-w-[80px]" aria-hidden />
    </footer>
  )
}
```

> 用 `flex-1 max-w-[80px]` 而非固定 `w-[60px]`：在窄 / 寬 viewport 兩端線會自然延伸到合理長度，置中視覺不變。

---

## 4. 互動

純展示，無事件。

---

## 5. 變體

`label` 可換字串（罕用）；預設「愛心沒有底線」是本作業品牌標語。

---

## 6. 狀態

純展示。

---

## 7. 測試（colocated `BrandFooter.test.tsx`）

- 渲染預設 label「愛心沒有底線」
- 自訂 label 渲染正確
- 渲染左右兩條 `<span>` 橫線

---

## 8. a11y

- `<footer>` semantic（landmark）
- `aria-label="品牌標語"`（避免被當成主要 navigation）
- 兩條橫線 `aria-hidden`
- text 不放 heading（不是 heading 性質）

---

## 9. 開放問題

- **位置 sticky**：目前 footer 在內容流末端；若要 sticky bottom（list 短時也黏底），需 `position: sticky bottom-0`，但會跟內部 scroll 衝突。本 spec v0.2 不做
- **多 footer 衝突**：HTML 規範 `<footer>` 可多個（每個 `<main>` / `<section>` 一個），但 page 層級語意只有一個。本作業簡單頁面用 1 個即可
