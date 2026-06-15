# Spec 004：詳情頁（Detail Pages，index）

- **狀態**：Draft（v0.2 — 新增 §3.1 橫向關聯導航 `replace` 策略）
- **建立日期**：2026-06-14
- **依賴**：
  - [brief §2.5 詳情頁元素](../brief.md#2-設計畫面盤點)
  - [002 §3.2 per-resource schema](./002-list-data.md#3-schemas--srclibschemaslistts)
  - Backend [spec 017 detail APIs](../../../backend/docs/specs/017-detail-apis.md)
- **下游**：[003e1 / 3 個 card](./003e-charity-card.md) 整張卡 `<Link>` 至此

---

## 1. 範圍

三個詳情頁，路由 + 資料 + 視覺：

| 頁 | 路由 | 對應截圖 | Backend endpoint | 子 spec |
|---|---|---|---|---|
| 公益團體介紹 | `/charities/:id` | IMG_4876 | `GET /v1/donation/charities/:id` | [004a](./004a-charity-detail.md) |
| 捐款專案介紹 | `/donation-projects/:id` | IMG_4883 | `GET /v1/donation/donation-projects/:id` | [004b](./004b-donation-project-detail.md) |
| 義賣商品介紹 | `/sale-items/:id` | IMG_4882 | `GET /v1/donation/sale-items/:id` | [004c](./004c-sale-item-detail.md) |

---

## 2. 共通結構

三頁共用的元素 / 行為：

| 元件 | 細節 |
|---|---|
| TopNav（[003b](./003b-topnav.md)） | 紅底，返回按鈕；標題依頁；右上「分享」icon button — **作業範圍外，不接 onClick**（保留 prop） |
| 主視覺 hero | charity = 紅底大 logo + 名稱；donation/item = cover image |
| Categories tags | 每頁底部前的 tag pills；資料同 [002 §3.1 CATEGORY_LABELS](./002-list-data.md) |
| Sticky CTA | 紅底全寬按鈕，固定在底部（safe-area 適配）；charity = 「直接捐款給團體」；donation/item = 「立即捐款」 — **作業範圍外，UI only 不接金流** |

> CTA 點擊：可只 `console.log('CTA clicked')` 或開 toast「此功能屬非作業範圍」。實作 PR 可定。

---

## 3. 路由結構

```
src/app/
├── charities/
│   ├── page.tsx                  # 既有列表（spec 003）
│   └── [id]/
│       ├── page.tsx              # 公益團體詳情（spec 004a）
│       ├── loading.tsx           # skeleton
│       └── error.tsx
├── donation-projects/
│   └── [id]/page.tsx             # spec 004b
└── sale-items/
    └── [id]/page.tsx             # spec 004c
```

> 統一規範：詳情頁皆為 **Server Component** 預設；RSC `fetch` backend，把 data 傳給內層 client component（CTA、分享 button、展開描述「更多」屬於有 state 的 island）。

### 3.1 橫向關聯導航策略（v0.2 新增）

「往下鑽」(list → 詳情) 與「橫向切換」(詳情 A → 詳情 B 的關聯項目) 兩種行為的 history stack 應採不同策略，達到 UX 最佳：

| 連結來源 | 目的地 | 策略 | 為何 |
|---|---|---|---|
| list 卡片（[003e1/e2/e3](./003e-charity-card.md)） | 詳情頁 | `push`（Next `<Link>` 預設） | 「進去看」是 forward；返回回 list |
| 詳情頁 的「查看團體 ›」chip ([004b §4](./004b-donation-project-detail.md#4-元件結構) / [004c §4](./004c-sale-item-detail.md#4-元件結構)) | charity 詳情 | **`replace`**（`<Link href="..." replace>`） | 「換看這個團體」是 lateral，不該堆 history |
| charity 詳情 →「捐款專案」cross-link ([004a §3](./004a-charity-detail.md#3-資料流)) | 對應 donation/item 詳情 | **`replace`** | 同上 lateral |
| Sticky CTA「立即捐款」 | （金流外部頁，作業範圍外） | n/a | — |

**為什麼 `replace`：**
- 不堆 history → 詳情 A 按返回不會卡到詳情 B（user 直觀返回 list）
- 對齊 Instagram / Twitter / Apple HIG「lateral navigation 不堆 stack」慣例
- 代價：lose「回上個詳情頁」的能力 — net positive，因為從詳情頁返回的 95% 意圖是「回 list」

**反例（為何不該 `push`）：**
詳情 A → chip → 詳情 B → chip → 詳情 C → 按 4 次返回才能回 list；其間每按一次都跳到一個「以為已經看完」的詳情頁，違反返回直覺。

> 實作：`<Link href="..." replace>` props；無需其他改動。

### 3.2 直接訪問詳情頁 URL 的返回行為（v0.3 新增）

直接打詳情頁 URL（typed / bookmark / external link）或在詳情頁 refresh → 站內無 nav 歷史。原本 TopNav 預設 `router.back()` 會無作用（瀏覽器 history 空），現由 [spec 005 §4 `useSmartBack`](./005-homepage-auth.md#4-smart-back-navigation-v02-新增) 處理：

- 站內動過 → `router.back()`（典型 `list → detail` 動線）
- 首訪 / 外站 → `router.push('/')`（TopNav 預設 fallback；詳情頁可改傳 `fallback="/donation"` 但目前統一回首頁）

詳情頁 3 條 RSC 完全不需手動 wire，吃 TopNav v0.3 預設即可。

---

## 4. BFF Route

三個詳情頁對應的 BFF route，沿用 spec 002 generic 風格：

```ts
// src/lib/api/createDetailRoute.ts
export function createDetailRoute(upstreamPath: (id: string) => string, schema: ZodType) { ... }

// src/app/api/charities/[id]/route.ts
export const GET = createDetailRoute(id => `/v1/donation/charities/${id}`, CharityDetail)
// src/app/api/donation-projects/[id]/route.ts
export const GET = createDetailRoute(id => `/v1/donation/donation-projects/${id}`, DonationDetail)
// src/app/api/sale-items/[id]/route.ts
export const GET = createDetailRoute(id => `/v1/donation/sale-items/${id}`, ItemDetail)
```

詳細 contract 見子 spec。

---

## 5. Schemas（detail，比 list item 多欄位）

詳細欄位定義在 backend spec 017，前端 schema 在 `src/lib/schemas/detail.ts`：

```ts
// 共同基底（list item 一致）
const Base = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  logoUrl: z.string().url().optional(),
  categories: z.array(CategoryKeyEnum),  // detail 必有
})

// Charity detail：加聯絡資訊 / 核准字號 / cross-link 子表
export const CharityDetail = Base.extend({
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  officialWebsite: z.string().url().optional(),
  approvalNo: z.string().optional(),       // 核准字號，如「台內團字第1110295700號」
})

// DonationProject detail
export const DonationProjectDetail = Base.extend({
  charity: z.object({ id: z.string().uuid(), name: z.string(), logoUrl: z.string().url().optional() }),
  coverImageUrl: z.string().url().optional(),
  raisingApprovalNo: z.string().optional(),  // 勸募立案核准字號
  reliefApprovalNo: z.string().optional(),   // 衛部救字號
  content: z.string(),                       // 完整專案內容（長文）
})

// SaleItem detail
export const SaleItemDetail = Base.extend({
  charity: z.object({ id: z.string().uuid(), name: z.string(), logoUrl: z.string().url().optional() }),
  coverImageUrl: z.string().url().optional(),
  priceTwd: z.number().int().nonnegative(),
  raisingApprovalNo: z.string().optional(),
  reliefApprovalNo: z.string().optional(),
  content: z.string(),
})
```

---

## 6. 共通行為

- **404 處理**：backend 回 `CHARITY_NOT_FOUND` / `DONATION_PROJECT_NOT_FOUND` / `SALE_ITEM_NOT_FOUND` → 前端 `notFound()` 顯示 `not-found.tsx`
- **「更多」展開**：IMG_4876 簡介末尾有「...更多」展開；client component 控制 collapsed state
- **分享 icon**：UI only，不接功能（[brief §3 非範圍](../brief.md#3-範圍與非範圍)）
- **CTA**：UI only，不接金流

---

## 7. 整體驗收

- [ ] 路由 `/charities/:id`、`/donation-projects/:id`、`/sale-items/:id` 三條都能進
- [ ] 404 case 顯示 `not-found`
- [ ] backend 5xx 顯示 error boundary（`error.tsx`）
- [ ] 三頁分別對齊 IMG_4876 / 4883 / 4882 主要視覺
- [ ] 點列表卡片可以跳對應詳情頁（往返路由保留 scroll position 屬增強，不強制）
- [ ] 詳情頁的「分享」+「捐款」按鈕只刻 UI，不接功能

---

## 8. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-14 | 初版：對應 IMG_4876 / 4883 / 4882 補件揭露 |
| 0.2 | 2026-06-14 | 新增 §3.1 橫向關聯導航 `replace` 策略：詳情頁互鏈用 `<Link href replace>`，按返回必回 list 不會卡到其他詳情頁 |
| 0.3 | 2026-06-15 | 新增 §3.2 直接訪問詳情頁 URL 的返回行為：透過 [spec 005 §4 smart back](./005-homepage-auth.md#4-smart-back-navigation-v02-新增) 處理（首訪 → push fallback / 站內 nav → router.back），詳情頁本身無需改 |
