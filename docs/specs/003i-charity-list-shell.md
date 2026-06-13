# Spec 003i：CharityListShell（feature）

- **狀態**：Draft（v0.3 — 加 category state + CategoryMenu 串接）
- **路徑**：`src/components/features/CharityListShell.tsx`
- **依賴**：
  - [003a Design System](./003a-design-system.md)
  - [003b TopNav](./003b-topnav.md) / [003c SearchBar](./003c-searchbar.md) / [003d TabsRow](./003d-tabsrow.md) / [003k FilterButton](./003k-filter-button.md) / [003l BrandFooter](./003l-brand-footer.md) / [003m CategoryMenu](./003m-category-menu.md)
  - [003j ResourceInfiniteList](./003j-charity-list.md)
  - [002 Data §7.1 useDebouncedValue](./002-list-data.md#71-usedebouncedvalue) / [§7.2 useUrlSync](./002-list-data.md#72-useurlsyncq--tab-同步) / [§3 ResourceKey + CategoryKey](./002-list-data.md#3-schemas)
- **Figma 對應**：整體頁面（`1:2226` / `1:2247` / `1:2213`）的 chrome + composition
- **複用性**：**低**（feature） — orchestrate 業務 state 流（draft / debounced / activeTab / URL）。模式可仿造別的列表頁，但本元件不複用

---

## 1. 職責

Orchestrate chrome 元件（TopNav / FilterButton / CategoryMenu / SearchBar / TabsRow）+ 三個 `ResourceInfiniteList`（per tab） + BrandFooter，管理：

- `draft` state（即時打字）
- `debouncedQ`（300ms 後送下去）
- `activeTab` state（charity / donation / item）
- `selectedCategory` state（null = 「全部」）
- `isMenuOpen` state（CategoryMenu 開合）
- URL `?q=` + `?tab=` + `?category=` 同步

本元件**不**直接呼叫 BFF — 只負責 state + composition + 把對應的 `enabled` / `category` 傳給三個 list。

---

## 2. Props

```ts
import type { ResourceKey } from '@/lib/schemas/list'
import type { CategoryKey } from '@/lib/schemas/categories'

type CharityListShellProps = {
  /** 由 RSC（spec 002 §5）從 searchParams 傳入；hydrate 後本元件接管 */
  initialQ: string
  initialTab: ResourceKey
  initialCategory: CategoryKey | null
}
```

> 命名保留 `CharityListShell` 是因「捐款項目列表」整頁的 Shell；不限 charity tab。

---

## 3. Anatomy

```tsx
'use client'
import { useState } from 'react'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useUrlSync } from '@/lib/hooks/useUrlSync'
import { TopNav } from '@/components/ui/TopNav'
import { FilterButton } from '@/components/ui/FilterButton'
import { CategoryMenu } from '@/components/ui/CategoryMenu'
import { SearchBar } from '@/components/ui/SearchBar'
import { TabsRow } from '@/components/ui/TabsRow'
import { BrandFooter } from '@/components/ui/BrandFooter'
import { ResourceInfiniteList } from './ResourceInfiniteList'
import type { ResourceKey } from '@/lib/schemas/list'
import { type CategoryKey, getCategoryLabel } from '@/lib/schemas/categories'

export function CharityListShell({
  initialQ,
  initialTab,
  initialCategory,
}: CharityListShellProps) {
  const [draft, setDraft] = useState(initialQ)
  const [activeTab, setActiveTab] = useState<ResourceKey>(initialTab)
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(initialCategory)
  const [isMenuOpen, setMenuOpen] = useState(false)
  const debouncedQ = useDebouncedValue(draft.trim(), 300)

  useUrlSync({
    q: debouncedQ,
    tab: activeTab === 'charity' ? undefined : activeTab,
    category: selectedCategory ?? undefined,
  })

  return (
    <div className="min-h-dvh bg-surface-page flex flex-col">
      <TopNav title="所有捐款項目" />
      <div className="px-[15px] pt-[15px] flex items-center gap-3">
        <FilterButton
          label={getCategoryLabel(selectedCategory)}
          onClick={() => setMenuOpen((o) => !o)}
          isOpen={isMenuOpen}
        />
        <SearchBar
          value={draft}
          onChange={setDraft}
          onCancel={() => setDraft('')}
        />
      </div>
      {/* CategoryMenu (003m v0.4) 是 bottom-sheet modal — fixed inset-x-0 bottom-0；
          無需 anchor 在 FilterButton 旁，渲染在頁面層級即可 */}
      <CategoryMenu
        isOpen={isMenuOpen}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
        onClose={() => setMenuOpen(false)}
      />
      <div className="mt-[6px]">
        <TabsRow active={activeTab} onTabChange={setActiveTab} />
      </div>
      {/* 三個 list 同時 mount；非 activeTab 的 hook enabled=false 不打網路 */}
      <div className="flex-1">
        <ResourceInfiniteList resource="charity"  q={debouncedQ} category={selectedCategory} active={activeTab === 'charity'}  />
        <ResourceInfiniteList resource="donation" q={debouncedQ} category={selectedCategory} active={activeTab === 'donation'} />
        <ResourceInfiniteList resource="item"     q={debouncedQ} category={selectedCategory} active={activeTab === 'item'}     />
      </div>
      <BrandFooter />
    </div>
  )
}
```

| Layout 區域 | 規格 |
|---|---|
| Page wrapper | `min-h-dvh bg-surface-page flex flex-col`（讓 footer 黏底） |
| TopNav | 自帶 chrome |
| Top row（FilterButton + SearchBar） | `px-[15px] pt-[15px] flex items-center gap-3`（對齊 Figma frame `1:2339` 的 layout `5EY9TI`） |
| CategoryMenu 位置 | **頁面層級渲染**（bottom-sheet modal，自己 `fixed inset-x-0 bottom-0`）；不需 anchor 在 row 內 |
| TabsRow 上邊距 | `mt-[6px]` |
| 三個 ResourceInfiniteList | `flex-1` wrapper 推 footer 到底；各自管內邊距；非 active 的渲染 `display:none`（保留 scroll position） |
| BrandFooter | 自帶 padding；自然出現在 list 下方（內容短時 `flex-1` 推到底） |

### 3.1 「三個 list 同時 mount」的取捨

兩種選擇：

| 方式 | 利 | 弊 |
|---|---|---|
| **三 list 同 mount + `active` prop 控顯隱**（本 spec v0.2 採用） | 切 tab scroll position 保留；切回 cache 仍在 | DOM 略大（三個 list 的 wrapper） |
| **conditional render**（只 mount active） | DOM 簡潔 | 切回 tab 滾回頂端；對 user 體感差 |

scroll position 保留比 DOM 大小重要（mobile 體感）。3 個 list 的非 active wrapper 用 `display: none` 隱藏（不 unmount），DOM 成本可控。

---

## 4. State 流

```
RSC (spec 002 §5)
  └─ initialQ, initialTab, initialCategory = searchParams.{q, tab, category}
        ↓
<CharityListShell initialQ initialTab initialCategory>
  ├─ useState draft = initialQ                  ← 即時打字
  ├─ useState activeTab = initialTab            ← 哪個 tab 顯示
  ├─ useState selectedCategory = initialCategory ← 篩選分類
  ├─ useState isMenuOpen = false                ← CategoryMenu 開合
  ├─ debouncedQ = useDebouncedValue(draft.trim(), 300)
  ├─ useUrlSync({ q, tab, category })
  └─ <FilterButton label={getCategoryLabel(category)} onClick={toggleMenu} isOpen />
  └─ {isMenuOpen && <CategoryMenu selectedCategory onSelect={setCategory} onClose />}
  └─ <SearchBar value={draft} onChange={setDraft} onCancel={() => setDraft('')} />
  └─ <TabsRow active={activeTab} onTabChange={setActiveTab} />
  └─ 3 × <ResourceInfiniteList resource q={debouncedQ} category={selectedCategory} active={resource === activeTab} />
        其中 active=false 的 list：
          - wrapper 套 `hidden` (display:none)
          - hook enabled=false 不打網路（由 list 元件處理）
```

### 4.1 draft / debouncedQ / activeTab / selectedCategory / URL

- **draft**：鍵盤敲擊更新，反映 SearchBar 顯示
- **debouncedQ**：300ms 沒新打字才更新；傳給三個 list
- **activeTab**：點 tab 即時更新（無 debounce）
- **selectedCategory**：點 CategoryMenu option 即時更新（無 debounce）；null = 「全部」
- **isMenuOpen**：FilterButton 點擊 toggle、CategoryMenu 點選 / 點外 / Esc 設 false
- **URL**：跟著 debouncedQ + activeTab + selectedCategory 變動；default 值（charity / null）不寫入 URL

### 4.2 「取消」按鈕

```
SearchBar onCancel
  ↓
setDraft('')
  ↓
useDebouncedValue 300ms → debouncedQ === ''
  ↓
useUrlSync drop ?q=
  ↓
三個 list queryKey 變 ['list', resource, { q: '' }]
  ↓
active 那個 list 自動 refetch；其他兩個 hook 仍 enabled=false 不動
```

### 4.3 切 tab 流

```
TabsRow onTabChange('donation')
  ↓
setActiveTab('donation')
  ↓
useUrlSync 把 ?tab=donation 寫入 URL
  ↓
<ResourceInfiniteList resource="donation" active={true}>  ← hook enabled 切 true
       enabled=true 第一次 → fetchListPage(/api/donations) → render
<ResourceInfiniteList resource="charity"  active={false}> ← wrapper hidden，hook idle
```

> 切回 charity 30s 內：TanStack cache hit → 不打網路、立即顯示。

### 4.4 切 category 流

```
FilterButton onClick → setMenuOpen(true) → <CategoryMenu> 渲染
  ↓
user 點「流浪動物」option
  ↓
CategoryMenu onSelect('animal') → setSelectedCategory('animal') → onClose() → setMenuOpen(false)
  ↓
useUrlSync 把 ?category=animal 寫入 URL
  ↓
FilterButton label 更新為「流浪動物 ▼」
  ↓
三 list queryKey 含 category 都變動；但只 active 那個 enabled=true → 重新 fetch
  其他兩 tab 換 category 的 cache（30s 內切過去命中）
```

點「全部」→ `setSelectedCategory(null)` → URL drop `?category=` → 同 flow。

---

## 5. 變體

無：本元件純 orchestration。所有差異來自子元件或資料層狀態。

---

## 6. 測試（colocated `CharityListShell.test.tsx`）

> Test 屬 integration 性質 — 渲染整個 shell，mock `useResourceListInfinite`、`useUrlSync`、`useRouter`。

- 初始：`initialQ="foo" initialTab="donation" initialCategory="animal"` → SearchBar 顯示 "foo"、TabsRow active="donation"、FilterButton label="流浪動物"
- 打字「bar」→ draft 變 "foobar"；300ms 後 list q 收到 "foobar"
- 連續打 10 字 → debouncedQ 只更新 1 次（spy call count）
- 按取消 → 300ms 後 list q 收到 ""；URL params 不含 `q`
- 點 TabsRow charity → activeTab state 變 'charity'；URL `?tab=` 被 drop（default tab）
- 點 TabsRow item → activeTab state 變 'item'；URL `?tab=item`
- 切 tab 時 debouncedQ 與 selectedCategory 不被洗
- 點 FilterButton → setMenuOpen(true) → CategoryMenu 渲染
- 在 menu 點「環境保護」→ selectedCategory='environment'、isMenuOpen=false、URL `?category=environment`
- 在 menu 點「全部」→ selectedCategory=null、URL drop `?category=`
- 三個 ResourceInfiniteList 都被 mount；只有 active 那個 `active=true`；三個都收 `category={selectedCategory}`

---

## 7. a11y

- `<TopNav>` 提供 `<h1>` 層級
- `<TabsRow>` 提供 tab + tablist semantic
- SearchBar input 有 placeholder + `type="search"`
- 可改 `<main className="min-h-dvh ...">` 強化 landmark（目前 `<div>`，[開放問題 §8](#8-開放問題)）

---

## 8. 開放問題

- **`<main>` 還是 `<div>`**：landmark 完整度 vs 簡潔；建議 `<main>` 但本 spec 用 `<div>` 是現狀
- **Cancel 是否清空 draft**：[003c SearchBar §9](./003c-searchbar.md#9-開放問題) — 目前 Shell 端做 `setDraft('')`
- **initialQ 為 80 字超長**：Shell 接，BFF route 在 q.trim() 後 reject 超 80 字。視覺要不要主動 truncate？目前不做
- **切 tab 時是否清空 draft**：目前不清，跨 tab 共用 q。spec 002 §11 列為開放問題
- **三 list 同 mount 的 DOM 成本**：未 active 的 list wrapper `display:none` 但仍 mount。若評審反映「打開頁面卡頓」可改成 conditional render（犧牲 scroll restore）

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-13 | 初版（單 tab，hardcode `active="charity"`，無 tab state） |
| 0.2 | 2026-06-14 | 三 tab + `activeTab` state + `useUrlSync` + 三 list 同 mount active prop |
| 0.3 | 2026-06-14 | 加 `selectedCategory` + `isMenuOpen` state + 串 [003k FilterButton](./003k-filter-button.md) / [003m CategoryMenu](./003m-category-menu.md)；三 list 收 `category` prop；`initialCategory` 由 RSC 預載 |
| 0.4 | 2026-06-14 | 配合 003m v0.4 改 bottom-sheet：拿掉 FilterButton wrapper 的 `relative`、CategoryMenu 渲染上提到頁面層級（不再嵌在 row 內） |
