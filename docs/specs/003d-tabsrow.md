# Spec 003d：TabsRow

- **狀態**：Draft（v0.2 — 三 tab 皆 active 可互動）
- **路徑**：`src/components/ui/TabsRow.tsx`
- **依賴**：[003a Design System](./003a-design-system.md)、[002 §3 ResourceKey](./002-list-data.md#3-schemas--srclibschemaslistts)
- **Figma 對應**：component `1:323`
- **複用性**：**中** — Tab key + 文案 (`charity / donation / item`) 目前 hardcoded 在元件內。要全圈通用需重構為 `items: { key, label }[]` prop（[開放問題 §9](#9-開放問題)）

---

## 1. 職責

水平三個 tab：「公益團體」/「捐款專案」/「義賣商品」。三個皆 active 可互動，受控元件（active + onTabChange）。底部 1px divider；active tab 有 3px 底線。

---

## 2. Props

```ts
import type { ResourceKey } from '@/lib/schemas/list'

type TabsRowProps = {
  active: ResourceKey                       // 'charity' | 'donation' | 'item'
  onTabChange: (next: ResourceKey) => void
}
```

> `ResourceKey` 由 [spec 002](./002-list-data.md#3-schemas--srclibschemaslistts) 定義並 export，三個元件（TabsRow / Shell / ResourceInfiniteList）共用同一型別來源。

---

## 3. Anatomy

| 元素 | 規格 |
|---|---|
| Container | `flex w-full h-11 border-b border-black/5` |
| Each tab button | `flex-1 flex items-center justify-center relative` |
| Active label | `text-base font-medium text-ink-AAA leading-6` |
| Inactive label | `text-sm font-medium text-ink-AAA leading-[19px]` |
| Active underline | `absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-full bg-brand-400 rounded-t-sm` |

```tsx
'use client'
import type { ResourceKey } from '@/lib/schemas/list'

const TABS: { key: ResourceKey; label: string }[] = [
  { key: 'charity',  label: '公益團體' },
  { key: 'donation', label: '捐款專案' },
  { key: 'item',     label: '義賣商品' },
]

export function TabsRow({ active, onTabChange }: TabsRowProps) {
  return (
    <div role="tablist" className="flex w-full h-11 border-b border-black/5">
      {TABS.map((t) => {
        const isActive = t.key === active
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(t.key)}
            className="flex-1 flex items-center justify-center relative"
          >
            <span className={isActive
              ? 'text-base font-medium text-ink-AAA leading-6'
              : 'text-sm font-medium text-ink-AAA leading-[19px]'}>
              {t.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-full bg-brand-400 rounded-t-sm" />
            )}
          </button>
        )
      })}
    </div>
  )
}
```

---

## 4. 互動

| 動作 | 行為 |
|---|---|
| 點任一 tab | `onTabChange(key)` — 父層更新 `activeTab` state；[Shell](./003i-charity-list-shell.md) 同時觸 URL sync |
| 點已 active 的 tab | `onTabChange` 仍呼叫（父層 idempotent，由 [Shell](./003i-charity-list-shell.md) 決定要不要 no-op） |
| 鍵盤 Tab/Shift+Tab 移焦 | 預設 `<button>` 行為 |
| 鍵盤 Enter/Space | 觸 onClick → onTabChange |

> spec v0.1 把 donation / item 設 `disabled`；v0.2 brief 改為三 tab 皆實作，移除 disabled。

---

## 5. 變體

僅 active 切換。inactive 字級 14、active 字級 16 — Figma 確認過的兩種尺寸，反映「強調 active」的視覺意圖。

---

## 6. 狀態

純展示。無內部 state（受控）。

---

## 7. 測試（colocated `TabsRow.test.tsx`）

- `active="charity"` → 公益團體底下渲染 underline、其他不渲染
- `active="donation"` → 捐款專案有 underline
- 三個 tab 都沒 `disabled` attribute
- 點任一 tab → onTabChange 被呼叫且收到對應 key
- 三個 label 文字渲染正確
- `role="tablist"` + 三個 `role="tab"` + `aria-selected` 正確

---

## 8. a11y

- `role="tablist"` 容器 + `role="tab"` 每個按鈕 + `aria-selected` 反映 active
- 完整 ARIA Tabs pattern（含 `aria-controls` 指到 tabpanel）可加；但本作業是「同一個 list slot 換內容」，不是真分 panel；目前**只用** `role/aria-selected` 表達 active，不接 `aria-controls`
- `<button type="button">` semantic

> 未來若改成真正每個 tab 對應獨立 panel（保留 scroll / state），加 `aria-controls` 指各自 panel id 並設 `<div role="tabpanel" />`。

---

## 9. 開放問題

- **動效**：tab 切換時底線滑動而非閃現 — 可後加 `transition-all` + 計算 underline 位置
- **泛化 props**：若要支援 N 個 tab，把 `TABS` 從 hardcoded 改成 `items: { key, label }[]` prop。本作業固定 3 個不做
- **完整 ARIA Tabs pattern**：每個 tab `aria-controls` 指 panel id；本 spec 未做
