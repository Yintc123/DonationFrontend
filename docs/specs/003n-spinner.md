# Spec 003n：Spinner

- **狀態**：Draft（v0.2 — 改 iOS 8-spoke 樣式對齊 Figma `shimmer` 1:1017）
- **路徑**：`src/components/ui/Spinner.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)（ink-A token）
- **Figma 對應**：component `1:1017` (`shimmer`)，24×24，使用於 frame `1:2247`「分類列表 - 搜尋中」
- **複用性**：**高** — `label?` + `size?` 純 props；任何 loading / pending 場景都可用

---

## 1. 職責

**iOS 經典 8-spoke 旋轉指示器**，視覺對齊 Figma `shimmer` component。

8 條 rect 環繞中心、opacity 漸層 (1/8 ~ 8/8) 形成「trail」效果；wrapper 用 `animate-spin` + `animation-timing-function: steps(8)` 做 8 tick / 0.8s 旋轉。

當前使用：
- [003i Shell §3.4](./003i-charity-list-shell.md#34-browse-vs-search-兩模式-layoutv07-新增) search 模式 `isPending` (debounce 進行中) → `<Spinner />` 24×24 居中
- 未來 TanStack Query `isFetching`（spec 002 §6 上線後）可直接 reuse

---

## 2. Props

```ts
type SpinnerProps = {
  /** SR aria-label；視覺上不顯示（對齊 Figma，只有 icon）。預設「載入中…」 */
  label?: string
  /** sm = 16 / md = 24（預設，對齊 Figma 24×24）/ lg = 32 */
  size?: 'sm' | 'md' | 'lg'
}
```

> **無視覺文字**：Figma `shimmer` 只是 icon，不附文字。本元件保持一致 — `label` 只給 SR，不渲染 `<p>`。

---

## 3. Anatomy

```tsx
<span
  role="status"
  aria-label={label}
  className={`inline-block ${wh} text-ink-A`}
>
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="w-full h-full animate-spin motion-reduce:animate-none"
    style={{ animationDuration: '0.8s', animationTimingFunction: 'steps(8)' }}
  >
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
      <rect
        key={angle}
        x="11"
        y="2"
        width="2"
        height="6"
        rx="1"
        fill="currentColor"
        opacity={(i + 1) / 8}
        transform={`rotate(${angle} 12 12)`}
      />
    ))}
  </svg>
</span>
```

| 元素 | 規格 |
|---|---|
| Wrapper | `<span role="status" aria-label={label} className="inline-block w-6 h-6 text-ink-A">`（size 控 w/h） |
| SVG | `viewBox="0 0 24 24"`、`aria-hidden`、`animate-spin motion-reduce:animate-none` |
| Animation timing | `duration: 0.8s` + `timing-function: steps(8)` → 8 tick/秒、每 tick 45° |
| 8 個 spokes | `<rect x="11" y="2" width="2" height="6" rx="1">`，繞中心 `(12,12)` rotate 45° × i |
| Opacity 漸層 | `opacity = (i + 1) / 8`：第 1 spoke 0.125 → 第 8 spoke 1.0，trail 效果 |
| 顏色 | `fill="currentColor"` → caller 在 wrapper 的 `text-*` class 控（預設 `text-ink-A`） |

### 3.1 旋轉原理

- 整個 SVG 用 `animate-spin`（Tailwind 預設 `animation: spin 1s linear infinite`），override duration 與 timing-function
- `steps(8)` 把連續旋轉切 8 段、每段 45°
- 透過 opacity 漸層，視覺上「亮 spoke 一格一格跳到下個位置」，這正是 iOS 系統 spinner 的觀感（「ticking spinner」）

### 3.2 motion-reduce 安全網

`prefers-reduced-motion: reduce` 的使用者：SVG 不轉（`animate-none`），8 個 spoke 靜止顯示。`role="status"` + `aria-label` 仍朗讀。無感降級。

### 3.3 為什麼**不**用 `<p>` 顯示 label

對齊 Figma `shimmer` — 它只是 24×24 icon，沒附文字。視覺乾淨。label 走 a11y 通道（aria-label）給 SR。

如果未來需要「spinner + 文字」場景，可在 caller 端 wrap：

```tsx
<div className="flex items-center gap-2">
  <Spinner label="送出中…" size="sm" />
  <span>送出中…</span>  {/* 文字 caller 自繪 */}
</div>
```

---

## 4. 使用情境

| 場景 | 用法 | 來源 spec |
|---|---|---|
| Search 模式 debounce 進行中 | `<Spinner label="搜尋中…" />`（24×24） | [003i §3.4](./003i-charity-list-shell.md#34-browse-vs-search-兩模式-layoutv07-新增) |
| TanStack Query `isFetching` (未來) | `<Spinner label="載入中…" />`（24×24） | spec 002 §6 |
| 按鈕內 spinner（送出表單時） | `<Spinner size="sm" label="送出中…" />`（16×16） | 未來表單 spec |

---

## 5. a11y

- `role="status"` + `aria-label={label}` — SR polite-announce「載入中…」/「搜尋中…」等
- SVG `aria-hidden` — 視覺裝飾，SR 不重複讀
- `motion-reduce:animate-none` — `prefers-reduced-motion` 友善

---

## 6. 測試（colocated `Spinner.test.tsx`）

- 預設 label「載入中…」+ `role="status"`
- 自訂 label 套 aria-label
- 渲染 8 個 `<rect>`（iOS 風 spokes）
- 8 個 opacity 漸層 1/8 ~ 8/8（trail 效果）
- SVG 套 `animate-spin` + `steps(8)` + `motion-reduce:animate-none`
- 預設 size="md" → `w-6 h-6`（24×24）
- `size="sm"` → `w-4`
- `size="lg"` → `w-8`
- 預設色 `text-ink-A`（currentColor 由 wrapper 控）

---

## 7. 變體 / 邊界

- size 三選一；無其他變體
- label 為空字串 → SR 朗讀「空」較不友善；caller 應傳有意義字串
- 多個 Spinner 同時存在不互衝（無 global state）
- currentColor 機制：caller 可在 wrapper 加 `text-white`、`text-brand` 等 override 顏色（暗底按鈕內 spinner 變白等）

---

## 8. 開放問題

- **size="xl" / size="xs"**：目前 3 個尺寸夠用；視需求擴
- **行內 spinner + 文字**：caller 自組 flex；保持 Spinner 純 icon 角色不變
- **進度型 spinner**（已 loading X%）：本元件純 indeterminate；可未來加 `progress?: number` prop 走 `stroke-dasharray`
- **tone 變體**（白色 spinner 給暗底 button）：caller 在 wrapper 套 `text-white` 即可，無需新 prop

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-14 | 初版（ring spinner，border-line + border-t-brand）— 偏離 Figma |
| 0.2 | 2026-06-14 | **重寫對齊 Figma `shimmer` (1:1017)**：iOS 8-spoke 樣式、24×24、`steps(8)` 動畫、opacity trail；移除 `<p>` 文字 label（Figma 無）；color 走 currentColor 給 caller override；改 `label` 為 optional、`size` md=24（之前 md=40） |
