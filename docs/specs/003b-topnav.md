# Spec 003b：TopNav

- **狀態**：Draft
- **路徑**：`src/components/ui/TopNav.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、`public/figma/icon-chevron-left.svg`
- **Figma 對應**：component `1:32`（`_ Top Navigation - 2`）
- **複用性**：**高** — 純 props（title / onBack / accessory），無業務字眼；可在所有頁面使用

---

## 1. 職責

紅底白字的頁面頂部導覽列。顯示「返回」+ 標題 + 右側 optional 附件。本作業列表頁只有「返回」與「所有捐款項目」標題；右側 accessory 留 prop 但不接。

---

## 2. Props

```ts
type TopNavProps = {
  title: string
  onBack?: () => void
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
<header className="flex items-center w-full h-11 bg-brand px-[14px]">
  <button onClick={onBack} aria-label="返回" className="w-6 h-6 shrink-0">
    <img src="/figma/icon-chevron-left.svg" alt="" width={24} height={24} />
  </button>
  <h1 className="flex-1 text-center text-white text-[17px] font-bold leading-[22px] line-clamp-1">
    {title}
  </h1>
  <div className="min-w-6 shrink-0">{accessory}</div>
</header>
```

---

## 4. 互動

| 動作 | 行為 |
|---|---|
| 點返回 | `onBack?.()`；未傳 onBack → `router.back()` fallback 由消費者處理（本元件純展示） |
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
- 按 back button 觸 onBack
- 未傳 onBack 仍可點（不爆）
- accessory prop 渲染在右側

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
