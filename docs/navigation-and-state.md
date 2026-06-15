# Navigation & State：SPA 導航、scroll 還原、跨頁 state

- **目的**：解釋本專案頁面切換在「機制層」如何運作 — 為什麼按返回會記憶 scroll、tab、搜尋字。這不是設計決策，是 Next.js 框架行為知識的整理，供未來除錯與選型參考。
- **適用對象**：日後 maintainer / code reviewer 想理解「為什麼不用刻 scroll restore 也 work」
- **相關**：
  - 實作面：[spec 003i §10 上一頁狀態還原](./specs/003i-charity-list-shell.md#10-上一頁狀態還原v06-新增)
  - hook：[spec 002 §7.2 useUrlSync](./specs/002-list-data.md#72-useurlsyncq--tab-同步)

---

## 1. 本專案是 SPA 嗎？

**是。** Next.js App Router 用 `<Link>` 或 `router.push/replace` 切頁屬於 SPA navigation，Next 官方術語叫 **soft navigation**。

| 對照 | Hard（傳統） | Soft（Next App Router 預設） |
|---|---|---|
| Browser 行為 | full document reload | 不 reload，pushState 換 URL |
| React state | 全部清掉 | 保留 |
| script / CSS | 重新解析 | 不變 |
| scroll position | browser native 還原（only for hard） | **由 Next 自己處理** |
| 視覺 | 整片白閃 | 區域 transition |

驗證：點任一 `<Link>` 切頁，devtools Network → Doc 不會有新 document request；只有 `_rsc` payload fetch。

---

## 2. SPA 預設不會記憶 scroll position — 為什麼我們能記？

### 2.1 Browser 的 native `history.scrollRestoration`

```js
history.scrollRestoration
// 預設值：'auto' — browser 在 full reload + history 導航時自動還原 scroll
// 可設為：'manual' — browser 不管，由 app 自己處理
```

Hard navigation（你按 reload / 真的跳新 document）時，`auto` 才會啟動。
SPA 用 `history.pushState` **不觸發 document navigation lifecycle**，所以 native 還原**不會**啟動 — 這就是為什麼大多數 SPA 按返回會跑到頁頂。

### 2.2 Next.js 把它設成 `manual` 並自己手動還原

在我們的 dev server 跑時打開 devtools console：

```js
> history.scrollRestoration
'manual'   // ← Next runtime 啟動時設的
```

Next.js App Router 內部流程（簡化）：

```
forward (router.push / <Link> click):
  1. history.replaceState({ scrollY: window.scrollY }, ..., currentURL)  ← 把當前 scrollY 釘在當前 history entry
  2. fetch RSC payload for new URL
  3. history.pushState(null, ..., newURL)
  4. React 替換 UI
  5. window.scrollTo(0, 0)  ← 進新頁置頂（除非 scroll:false）

back (browser back button):
  1. browser fire popstate event
  2. Next 從 popped history entry 讀出 { scrollY }
  3. fetch RSC payload for popped URL
  4. React 替換 UI
  5. window.scrollTo(0, savedY)  ← 還原
```

所以「按返回記得 scroll」**不是我們寫的 code 做的**，是 Next.js runtime 幫做的。

### 2.3 與其他 SPA framework 對照

| Framework | 預設 scroll 還原行為 | 需要的工作 |
|---|---|---|
| Next.js App Router | **自動還原 forward/back scroll** | 無 |
| Next.js Pages Router | 自動還原（更早就內建） | 無 |
| React Router v6+ | **不會**還原 | 自己加 `<ScrollRestoration />` 元件 |
| Vue Router | 可配置 | 在 createRouter 傳 `scrollBehavior(to, from, savedPosition)` 函數 |
| SvelteKit | **自動還原** | 無 |
| Remix | 自動還原 | 無（v2+） |
| Vanilla `pushState` SPA | **不會**還原 | 自己 listen popstate + 存 sessionStorage |

不能假設「SPA = 沒 scroll 記憶」，要看 framework。

---

## 3. 跨頁 state 持久化的三層

本專案不用 Context / Redux / Zustand，而用以下三層各司其職：

### 3.1 URL searchParams — tab / 搜尋字 / 篩選分類

**Source of truth**：`/donation?tab=item&category=animal_protection&q=魚油`

- **寫**：[`useUrlSync`](../src/lib/hooks/useUrlSync.ts) — `router.replace(\`${pathname}?${qs}\`, { scroll: false })`
- **讀**：page.tsx 是 Server Component，從 `searchParams` prop 解析後傳 `initialQ / initialTab / initialCategory` 給 Shell
- **特性**：可分享、deep-linkable、refresh 不丟、forward/back 自動還原（Next 把 URL 也寫進 history state）

#### `useUrlSync` 必須注意的兩條 guard

```ts
// guard 1: 只在 URL 真的需要變動時呼叫 router.replace
if (newQs === currentQs) return
// guard 2: 帶 pathname，否則 router.replace('') 不會清掉既有 querystring
router.replace(newQs ? `${pathname}?${newQs}` : pathname, { scroll: false })
```

為何兩個 guard 都必要：
- 沒 guard 1 → `replace → RSC fetch → searchParams 新 ref → effect 再 fire → 又 replace` 無限迴圈
- 沒 guard 2 → 從 `?tab=item` 切回 default tab 時，URL 卡在 `?tab=item`（看起來 tab UI 是公益團體但 URL 顯示 item）

兩個 commit 補洞：`0cea936`、`d22b4fe`。

### 3.2 Browser history entry state — scroll position

- 由 Next runtime 自動 save / restore（§2.2）
- 我們無需寫任何 code
- 條件：`useUrlSync` 用 `{ scroll: false }` 避免 in-page state 變動造成意外 scroll-to-top

### 3.3 React `useState` — 短暫 UI state

- 用於：菜單開合 (`isMenuOpen`)、搜尋輸入字 (`draft`)、active tab 的 client copy
- 生命週期：本頁 mount~unmount
- 切到別頁後不保留 — 想保留就要往 §3.1 升級

### 3.4 為什麼不用 Context / Redux / Zustand

| 工具 | 解決的痛點 | 我們有這個痛點嗎 |
|---|---|---|
| Context | 同一份 state prop-drill 3+ 層、sibling subtree 共用 | 沒。Shell → 子元件只差 1-2 層 |
| Redux / Zustand | 複雜 client state、多 reducer、time-travel debug | 沒。Shell 就 4 個 useState、無 reducer |
| TanStack Query | server cache + dedupe + revalidate | 有，已規劃 (spec 002 §6.3 `useResourceListInfinite`) |

挑對 lifecycle 是關鍵；Redux 不該存 server data、URL params 不該塞 sessionStorage。

---

## 4. 卡片連結策略：push vs replace

[spec 004 §3.1](./specs/004-detail-pages.md#31-橫向關聯導航策略v02-新增) 規範：

| 連結 | 策略 | 為什麼 |
|---|---|---|
| list 卡片 → 詳情頁 | `push`（`<Link>` 預設） | forward navigation；按返回回 list |
| 詳情頁「查看團體 ›」chip → 另一個詳情頁 | **`replace`** | lateral navigation 不該堆 history；按返回必回 list |

對齊 Instagram / Twitter / Apple HIG。

---

## 5. 失敗場景與緩解

scroll 還原能準的兩個前提：

1. **新頁 DOM 高度在 `scrollTo` 那一刻已具備** — preview 階段用同步 fixture，沒問題
2. **頁面未被 unmount** — Shell 三 list 同 mount + `display:none`（[spec 003i §3.1](./specs/003i-charity-list-shell.md#31-三個-list-同時-mount-的取捨)）即滿足

### 5.1 spec 002 §6 BFF + TanStack Query 接上後可能的退化

```
[1] back navigation 觸發
[2] Next 立即 scrollTo(0, 1500)
[3] list 還在 pending（無內容） → DOM 高度不足
[4] scroll 落到 max（其實是 0）
```

緩解：spec 002 §5 的 RSC SSR prefetch 第一頁，保證首次 paint DOM 已有高度。

### 5.2 直接開啟詳情頁 URL 後按返回

歷史曾為已知限制（瀏覽器無上一頁可退 → `router.back()` 無作用）。**已於 2026-06-15 解決**：TopNav 預設改用 `useSmartBack(fallback)`（[spec 003b v0.3](./specs/003b-topnav.md#10-變更紀錄) / [spec 005 §4](./specs/005-homepage-auth.md#4-smart-back-navigation-v02-新增)）—— 站內動過走 `router.back()`，首訪 / 外站 / 直接 URL 走 `router.push(fallback)`（fallback 預設 `/`）。

關鍵設計：用 in-memory React context（`<InAppNavProvider>` + `usePathname` diff）追蹤本 tab 內是否曾切過 pathname，而**不**用 `document.referrer`（SPA navigation 不重新載入文件、referrer 不更新會誤判）也**不**用 `sessionStorage`（refresh 會被當成 nav 而誤算）。

### 5.3 Next 16 `cacheComponents: true` 升級可選

若未來需要連 **form draft / 展開狀態 / scroll** 全部都跨 navigation 保留，可開 `next.config.ts` 的 `cacheComponents` flag，Next 用 React `<Activity>` 把整頁 hide 不 unmount。但要遷移 `dynamic` / `revalidate` → `use cache` directive。BFF 上線後再評估。

---

## 6. 一句話總結

> SPA navigation **本身不會**記憶 scroll；本專案能記是因為 Next.js App Router runtime 預設啟用 manual scroll restoration，把 scrollY 釘在 history entry state 內。tab / 搜尋字 / 篩選靠 URL searchParams 持久化。我們無需自己刻 sessionStorage / Context / Redux。

---

最後更新：2026-06-15（補 §5.2 「直接 URL 按返回」已透過 `useSmartBack` 解決，連向 spec 005 §4）
