# Spec 003g：EmptyState

- **狀態**：Draft
- **路徑**：`src/components/ui/EmptyState.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、`public/figma/empty-no-data.png`
- **Figma 對應**：frame `1:2215`（`no data`），整體 frame `1:2213`（`搜尋 - No Result - 公益團體`）
- **複用性**：**高** — `illustration / title / subtitle` 純 props，無業務字眼；任何「列表空」/「搜尋無結果」/「未登入」場景都能用

---

## 1. 職責

「搜尋無結果」/「DB 真空」時取代列表顯示。包含 144×144 插畫 + 標題 + 副標。可重用：不綁 charity 業務，傳 props 即可。

---

## 2. Props

```ts
type EmptyStateProps = {
  illustration: string  // URL，預期是 PNG/SVG
  title: string
  subtitle?: string
}
```

---

## 3. Anatomy

| 元素 | 規格 |
|---|---|
| Container | `flex flex-col items-center gap-[18px] w-[319px] mx-auto mt-[64px]` |
| Illustration | `w-36 h-36 object-contain`（144×144） |
| Title | `text-xl font-medium leading-7 text-ink-AAA`（`ios/h4`） |
| Subtitle | `text-sm leading-[22px] text-ink-A`（`ios/p2`） |

```tsx
export function EmptyState({ illustration, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-[18px] w-[319px] mx-auto mt-[64px]">
      <img
        src={illustration}
        alt=""
        width={144}
        height={144}
        className="w-36 h-36 object-contain"
      />
      <h2 className="text-xl font-medium leading-7 text-ink-AAA">{title}</h2>
      {subtitle && (
        <p className="text-sm leading-[22px] text-ink-A">{subtitle}</p>
      )}
    </div>
  )
}
```

---

## 4. 使用情境

| 來源 | Props |
|---|---|
| [003j CharityList](./003j-charity-list.md) `q !== '' && items.length === 0` | `illustration="/figma/empty-no-data.png"`、`title="查無相關資料"`、`subtitle="請調整關鍵字再重新搜尋"` |
| 同上 `q === '' && items.length === 0`（DB 真空） | 同 illustration / `title="目前沒有公益團體"`，no subtitle |

> 「q 為空 vs 有 q」用同 illustration 但**不同文案**，由消費者（CharityList）判斷 q 決定文案。本元件不感知業務。

---

## 5. 變體

由 props 控（不在元件內 hard-code）。`subtitle` 缺則不渲染（gap 自然吸收）。

---

## 6. 測試（colocated `EmptyState.test.tsx`）

- 渲染 title
- 渲染 subtitle（有傳）
- 不渲染 subtitle（沒傳）
- 圖片 src 對應 illustration prop
- 圖片 alt 為空字串

---

## 7. a11y

- `<h2>` semantic（與 `<CharityCard>` 同層級，但 only one 出現）
- 插畫 `alt=""`（純裝飾；title 已表達語意）
- 對 screen reader 而言，無結果時聽到的是「查無相關資料 / 請調整關鍵字再重新搜尋」

> 進一步可加 `role="status" aria-live="polite"` 讓搜尋後 SR 自動讀出，但需注意「過於 chatty」風險（每次 query 變化都讀）。本 spec v0.1 不加。

---

## 8. 開放問題

- **不同情境的 illustration**：目前所有空狀態都用同一張；可未來分「搜尋無結果 / 真空」/「網路錯誤」/「未登入」用不同插畫，由 props 決定
- **CTA button**：「清空搜尋」按鈕 — Figma 沒給；可加，但要決定 hooks（清空 draft + URL）
- **`role="status" aria-live="polite"`**：a11y 增強 vs SR 雜訊 — 評估後決定
- **動效**：插畫 fade-in？目前無；可後加 framer-motion
- **PNG 容量**：spec 003a §4 提到可壓 1536→288 省 80%；本元件不負責處理
