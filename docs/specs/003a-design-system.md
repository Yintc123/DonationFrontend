# Spec 003a：UI 設計系統 — Tokens / Assets / RWD

- **狀態**：Draft（v0.3 — 對齊截圖補件 IMG_4875~4883 補 token）
- **建立日期**：2026-06-13（v0.1）/ 2026-06-14（v0.2 補 brand.soft + alert）/ 2026-06-14（v0.3 補 line / select / overlay token）
- **影響範圍**：`tailwind.config.ts`、`src/app/globals.css`、`public/figma/*`
- **依賴**：Figma file `0kx2Ne2rvndhfVr3uVUwad`（顏色 / 字級 source of truth）+ `docs/images/IMG_4875~4883`
- **下游**：所有 003b–003m 元件 spec

---

## 1. 範圍

提供整個列表頁的視覺基底：Tailwind 顏色 / 字體 token、靜態 asset 清單、RWD 規則。本檔**不**定義元件結構（由 003b–003j 負責）。

---

## 2. 顏色 token

`tailwind.config.ts` extend：

```ts
colors: {
  brand: {
    DEFAULT: '#C9191D', // TopNav / status bar bg / 主 CTA 紅按鈕 / 義賣 ribbon / 價格（Figma theme/bg-primary，對齊 IMG_4881~4883 大紅按鈕）
    400:     '#D63F3C', // active tab underline（Figma palette/brand/400）
    overlay: 'rgba(201,25,29,0.78)', // 003e2 DonationProjectCard 圖片底部「主辦團體名」紅色半透明 overlay（v0.3 補件，對齊 IMG_4875 圖片下緣）
  },
  ink: {
    AAA:  'rgba(0,0,0,0.9)', // primary text（card title、tab active label）
    AA:   'rgba(0,0,0,0.7)', // secondary text（card description）
    A:    'rgba(0,0,0,0.5)', // muted text（empty subtitle、magnifier icon fill）
    link: '#2E7DD9',         // 「取消」button、聯絡資訊連結（Figma theme/text-link）
  },
  surface: {
    page: '#F4F4F6',         // page bg（Figma theme/bg-AA）
    card: '#FFFFFF',         // card bg、modal sheet bg（Figma theme/bg-AAA）
  },
  line: {
    DEFAULT: 'rgba(0,0,0,0.10)', // 卡片 border、modal divider、category chip border
    soft:    'rgba(0,0,0,0.06)', // 細分隔線（003m header bottom）
  },
}
```

> **使用規則（v0.3 新增）**：
> 1. **禁止直接寫 hex**（如 `#EF4444`、`bg-red-500`）。
> 2. **允許**直接用 Tailwind 原生 `black/[opacity]` 語法（`bg-black/5`、`border-black/10`、`text-black/20`、`bg-black/40`）— 用於通用透明黑（hover bg、divider、backdrop）。
> 3. 「紅色」與「sale 紅」**統一**用 `brand.DEFAULT`（CTA 按鈕、義賣 ribbon、TWD 價格、CategoryMenu 選中態紅框紅字）—— 因 Figma 整套設計只用一種紅，不需 alert 系列。v0.2 暫設的 `alert.DEFAULT (#EF4444)` 於 v0.3 **撤回**。
> 4. 中性 border / divider 用 `border-line` token（線粗 `1px`）。

> Figma 的 `palette/gray/100`（`#EDEDF1`）視覺等價於 `black/5`（色差 < 2/255）；統一用 `bg-black/5` 避免多開 token，[003c SearchBar](./003c-searchbar.md) 與 [003k FilterButton](./003k-filter-button.md) 都這樣用。

> **v0.3 取消** `brand.soft`：截圖揭露 [003e2 DonationProjectCard](./003e2-donation-project-card.md) 的主辦團體名其實是**疊在圖片底部的紅色半透明 overlay**（白字），不是另起一條淺色 banner — 改用 `brand.overlay` token。

---

## 3. 字體 / 字級

### 3.1 字體 stack

```ts
fontFamily: {
  sans: ['"PingFang TC"', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
}
```

不用 NextFont 載 web font：PingFang TC 是 Apple 系統字（macOS / iOS 內建），台灣使用者 mobile / mac 直接命中；其他平台 fallback 到 Noto Sans TC（如裝了）或 system-ui。權衡：少幾 MB web font，犧牲少數 Linux / 舊 Windows 端的視覺一致性。

### 3.2 字級對映

| Figma type style | size / lh / weight | Tailwind |
|---|---|---|
| `ios/h4` | 20 / 28 / medium | `text-xl leading-7 font-medium` |
| `ios/h5` | 16 / 24 / medium | `text-base leading-6 font-medium` |
| `ios/p1` | 16 / 24 / regular | `text-base leading-6` |
| `ios/p2` | 14 / 22 / regular | `text-sm leading-[22px]` |
| `ios/p3` | 13 / 20 / regular | `text-[13px] leading-5` |
| `Caption 1/Medium TC` | 14 / 19 / medium | `text-sm leading-[19px] font-medium` |
| `Headline/bold`（SF Pro） | 17 / 22 / bold | `text-[17px] leading-[22px] font-bold` |

> SF Pro 只在 iOS status bar 用，本作業不渲染 status bar，所以實際只用到前 6 個。

---

## 4. Assets

從 Figma 下載並放 `frontend/public/figma/`：

| 檔名 | 來源 nodeId | 尺寸（原檔）| 用途 |
|---|---|---|---|
| `empty-no-data.png` | `I1:2216;49:128` | 1536×1536 | [003g EmptyState](./003g-empty-state.md) illustration（顯示 144×144） |
| `icon-magnifier.svg` | `I1:2224;728:30936` | 20×20 | [003c SearchBar](./003c-searchbar.md) 放大鏡（黑 50% opacity） |
| `icon-chevron-left.svg` | `I1:2214;104:6495;104:6488;104:6481` | 24×24 | [003b TopNav](./003b-topnav.md) 返回按鈕（白） |

引用：`<Image src="/figma/..." />` 或 `<img>`。SVG 不需 inline 化（不依賴 `currentColor`）。

> `empty-no-data.png` 是 @8x raw（~570KB）；瀏覽器會 downscale。若 Lighthouse 嫌肥可壓 288×288（~70KB）；本 spec v0.1 不強制。

---

## 5. RWD

設計基準 **375px**（iPhone X，Figma frame width）。

| breakpoint | 行為 |
|---|---|
| `< sm`（< 640） | 1 欄；卡片 `w-full max-w-[345px] mx-auto`；page padding `px-[15px]`（對齊 Figma list at x=15） |
| `sm` ~ `md`（640~1024） | 1 欄；外層 container `max-w-[480px] mx-auto` 收斂（避免在大平板 / 小桌面被拉太寬） |
| `md` 以上（>=1024） | 1 欄保持；不切多欄 grid |

理由：Figma 無 desktop layout，強行多欄反而失原意。可接受桌面 viewer 看到「手機般置中窄欄」，貼合「手機版 Web」的視覺。

> 多欄 grid（≥md 改成 2~3 卡並排）是潛在 enhancement，需另開 spec 並補 Figma 桌面設計稿。

---

## 6. 全域樣式

`src/app/globals.css`：

```css
@import 'tailwindcss';

@theme {
  /* Tailwind v4 用 @theme 宣告 token；上面 §2 / §3 的內容寫入此處 */
}

html, body {
  font-family: theme(fontFamily.sans);
  background-color: theme(colors.surface.page);
}
```

> Tailwind v4 採 CSS-first config（`@theme`）；若實作時 stable 為 v3，改回 `tailwind.config.ts`。

---

## 7. 驗收

- [ ] `tailwind.config.ts` / `globals.css` 含 §2 / §3 全部 token
- [ ] `public/figma/` 含 §4 三個檔案
- [ ] 任一元件 spec（003b–003j）引用顏色 / 字級時用 token 名（`bg-brand`、`text-ink-AAA`），不直接寫 hex
- [ ] RWD 在 375 / 480 / 1280 viewport 都正常（由 [003 overview](./003-charity-list-ui.md) §e2e 驗）

---

## 8. 開放問題

- **PNG 壓縮**：empty-no-data.png 可壓 1536→288 省 ~80% 容量
- **Dark mode**：Figma 無設計；本 spec 不提供
- **Tailwind v3 vs v4**：實作前確認專案 stable 版本，調整 token 宣告位置
- **`brand.overlay` 透明度確切值**：v0.3 用 `rgba(201,25,29,0.78)` 觀感對齊 IMG_4875；Figma 未明示，可在實作時微調 0.7~0.85 之間

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-13 | 初版（brand / ink / surface token、字級 mapping、3 assets） |
| 0.2 | 2026-06-14 | 補 `brand.soft` / `alert.DEFAULT` 供 003e2 banner / 003e3 ribbon / 價格使用 |
| 0.3 | 2026-06-14 | 截圖補件後修正：(a) 撤回 `brand.soft`（DonationProjectCard 是圖片底部紅色 overlay，非淺色 banner）；(b) 撤回 `alert.DEFAULT`（Figma 只用一種紅，ribbon / 價格 / CTA / 選中態統一 `brand.DEFAULT`）；(c) 新增 `brand.overlay`（圖片底部半透明紅）+ `line.DEFAULT` / `line.soft`（卡片 border、modal divider）；(d) 明確「禁 hex / 允許 black-opacity / 紅色統一 brand」三條規則 |
