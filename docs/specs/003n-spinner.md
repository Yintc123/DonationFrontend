# Spec 003n：Spinner

- **狀態**：Draft（v0.1）
- **路徑**：`src/components/ui/Spinner.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)（line / brand / ink-AA token）
- **Figma 對應**：無；Figma 對 list 頁無 loading 視覺，本元件自定，對齊 Material / Tailwind 常用 ring-spinner 視覺
- **複用性**：**高** — `label` + `size?` 純 props；任何 loading / pending 場景都可用

---

## 1. 職責

純 CSS 旋轉圈圈 + 下方 label 文字，表示「正在 loading / pending」。

當前使用：
- [003i Shell §3.4](./003i-charity-list-shell.md#34-browse-vs-search-兩模式-layoutv07-新增) search 模式 debounce 進行中（`isPending`）→ `<Spinner label="搜尋中…" />`
- 未來 TanStack Query 的 `isFetching` 狀態（spec 002 §6 上線後）可直接 reuse

---

## 2. Props

```ts
type SpinnerProps = {
  /** SR 朗讀 + 視覺顯示在 spinner 下方 */
  label: string
  /** sm = 24 (border 3px) / md = 40 (border 4px, 預設) / lg = 48 (border 4px) */
  size?: 'sm' | 'md' | 'lg'
}
```

`size` 預設 `'md'`；其他 spec 引用本元件時要明確指定（避免一致性失控）。

---

## 3. Anatomy

| 元素 | 規格 |
|---|---|
| Container | `<div role="status" aria-label={label} className="flex flex-col items-center gap-3">` |
| Ring | `<div aria-hidden>`、`rounded-full border-line border-t-brand animate-spin motion-reduce:animate-none`；size 控大小 / 邊框粗細 |
| Label | `<p className="text-sm text-ink-AA">{label}</p>` |

```tsx
export function Spinner({ label, size = 'md' }: SpinnerProps) {
  const ringSize =
    size === 'sm' ? 'w-6 h-6 border-[3px]'
    : size === 'lg' ? 'w-12 h-12 border-4'
    : 'w-10 h-10 border-4'

  return (
    <div role="status" aria-label={label} className="flex flex-col items-center gap-3">
      <div
        aria-hidden
        className={`${ringSize} rounded-full border-line border-t-brand animate-spin motion-reduce:animate-none`}
      />
      <p className="text-sm text-ink-AA">{label}</p>
    </div>
  )
}
```

### 3.1 旋轉原理

- 整個 `border` 是 `border-line`（淺灰，[003a §2](./003a-design-system.md#2-顏色-token)）
- `border-t-brand` 覆蓋掉頂部那一段（brand red）
- `animate-spin`（Tailwind v4 內建）= `animation: spin 1s linear infinite`
- 視覺：「灰色圈圈 + 一段紅色圓弧繞圈轉」

不依賴漸層、不需自定 `@keyframes`（共用 Tailwind 預設）。

### 3.2 motion-reduce 安全網

`prefers-reduced-motion: reduce` 的使用者：圈圈不轉（`animate-none`），但 label 仍正常顯示、`role="status"` 仍朗讀。無感降級。

---

## 4. 使用情境

| 場景 | 用法 | 來源 spec |
|---|---|---|
| Search 模式 debounce 進行中 | `<Spinner label="搜尋中…" />` | [003i §3.4](./003i-charity-list-shell.md#34-browse-vs-search-兩模式-layoutv07-新增) |
| TanStack Query `isFetching` (未來) | `<Spinner label="載入中…" />` | spec 002 §6 |
| 按鈕內 spinner（送出表單時） | `<Spinner size="sm" label="送出中…" />` | 未來表單 spec |

---

## 5. a11y

- `role="status"` + `aria-label={label}` — SR 朗讀「搜尋中…」、不需要使用者開啟即可被 polite announce
- Ring `aria-hidden` — 避免 SR 把「裝飾性 div」讀出
- `motion-reduce:animate-none` — `prefers-reduced-motion` 友善

---

## 6. 測試（colocated `Spinner.test.tsx`）

- 渲染 label 文字
- `role="status"` + `aria-label` 等於 label
- ring 套 `animate-spin` + `motion-reduce:animate-none`
- 預設 size="md" → `w-10 h-10`
- `size="sm"` → `w-6`
- `size="lg"` → `w-12`
- 視覺：ring 套 `border-line` + `border-t-brand`

---

## 7. 變體 / 邊界

- size 三選一；無其他變體（顏色 hard-code brand，避免散播色）
- label 為空字串 → 視覺上看不到文字但 ring 仍轉，`aria-label=""` 對 SR 不友善 — 不建議；caller 應傳有意義字串
- 多個 Spinner 同時存在不互衝（無 global state）

---

## 8. 開放問題

- **size="xl" / size="xs"**：目前 3 個尺寸夠用；視需求擴
- **行內 spinner**（label 在右而非下）：可加 `inline?: boolean` prop；目前未做（單一垂直 stack 即可）
- **進度型 spinner**（已 loading X%）：本元件純 indeterminate；可未來加 `progress?: number` prop 走 stroke-dasharray
- **顏色變體**（白色 spinner 給暗底 button）：可加 `tone?: 'brand' | 'inverse'`；目前無 dark-button 場景

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-14 | 初版：因 [003i v0.10](./003i-charity-list-shell.md) 把 search-mode debounce 進行中的視覺從 folder 圖示改成 spinner，新增本元件 |
