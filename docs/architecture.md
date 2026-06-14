# 架構：Next.js + BFF

## 1. BFF 的角色

**BFF（Backend For Frontend）**：在前端與真正的後端（NodeJS + Express/Fastify + ORM + DB）之間，由 Next.js 作為「為前端量身打造的中介後端」。

```
[Browser]
   │
   │ fetch / RSC
   ▼
[Next.js BFF]  ← 本專案 frontend/
   │ - Route Handlers（/api/*）
   │ - Server Components 直接呼叫
   │ - Session、聚合、欄位裁切、錯誤標準化、cache
   ▼
[Real Backend]  ← 本專案 backend/（Express/Fastify + Prisma）
   │ - Domain API（純資料）
   ▼
[Database]
```

### 為什麼用 BFF？
1. **欄位裁切與聚合**：頁面需要的資料形狀常與後端 domain model 不一致，BFF 在此聚合（避免 over-fetch / under-fetch）。
2. **隱藏後端**：瀏覽器只看得到 BFF，後端可放內網。
3. **快取策略集中**：Next.js 的 `revalidate`、`fetch cache`、`unstable_cache` 在 BFF 統一管理。
4. **型別共享**：前端元件、Route Handler、Zod schema 共用 TS 型別。

---

## 2. 資料夾結構（Next.js 16 App Router）

```
frontend/
├── docs/
│   ├── brief.md
│   ├── architecture.md
│   └── specs/                            # 實作規格（API、UI 行為）
├── public/                               # 靜態資產（從 Figma 匯出的 icon/image）
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # 首頁 → redirect 或 = 列表頁
│   │   ├── charities/
│   │   │   └── page.tsx                  # 公益團體列表頁
│   │   └── api/
│   │       └── charities/
│   │           └── route.ts              # BFF：GET /api/charities?q=&cursor=
│   ├── components/
│   │   ├── ui/                           # 純 UI（CharityCard、SearchBar、Tabs、EmptyState…）
│   │   └── features/                     # 帶業務邏輯（CharityList、SearchPanel）
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts                 # 瀏覽器端 → /api/* 的 fetch wrapper
│   │   │   └── backend.ts                # BFF → 真後端的 fetch wrapper（含 timeout/retry）
│   │   ├── schemas/                      # Zod schema（與 API DTO 共用）
│   │   └── query/                        # TanStack Query keys、infinite query hooks
│   ├── styles/
│   │   └── globals.css                   # Tailwind base
│   └── types/                            # 共用 TS 型別
├── tests/
│   ├── unit/                             # Vitest
│   └── e2e/                              # Playwright
├── .env.example                          # NEXT_PUBLIC_*, BACKEND_API_URL
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. 資料流（以列表 + 搜尋為例）

### 桌面/手機初次載入
```
Browser ─GET /charities──▶ Next.js (RSC) ─fetch──▶ /api/charities
                                                       │
                                                       ▼
                                              Route Handler
                                                       │
                                          ┌────────────┴────────────┐
                                          ▼                         ▼
                                   Mock 模式：讀 fixture    真後端模式：fetch BACKEND_API_URL
                                          │                         │
                                          └────────────┬────────────┘
                                                       ▼
                                                Zod parse + reshape
                                                       │
                                                       ▼
                                                  JSON response
```

### 無限滾動（client）
```
useInfiniteCharities()
  │ initialData ← RSC 預載第一頁
  │ fetchNextPage()
  ▼
GET /api/charities?q=...&cursor=<nextCursor>
```

### 搜尋（client）
- 使用者輸入 → debounce 300ms → 更新 query key → TanStack Query 自動 refetch
- URL 同步：`?q=...`（用 `useSearchParams` + `router.replace`）→ 重新整理後保留狀態

---

## 4. 與真後端的銜接

- BFF → 真後端：`BACKEND_API_URL`（環境變數，僅 server 端可見）
- 在後端尚未實作期間，BFF Route Handler 直接讀 `src/lib/mock/charities.ts` 的 fixture，**對前端的 contract 不變**，未來切換無痛
- 真後端啟動後，BFF 的內容大致只是「轉發 + 欄位裁切 + 錯誤格式化」

---

## 5. 環境變數

| 變數 | 範圍 | 用途 |
|---|---|---|
| `BACKEND_API_URL` | server only | BFF → 真後端 base URL |
| `NEXT_PUBLIC_APP_NAME` | client + server | UI 顯示用 |
| `USE_MOCK` | server only | 切換 BFF 是否走 mock fixture |

> `.env` 加入 `.gitignore`，提供 `.env.example` 作為範本。

---

## 6. 錯誤處理

| 來源 | 處理方式 |
|---|---|
| BFF → 真後端逾時 / 5xx | 回 `503` + 標準錯誤格式（`{ code, message }`） |
| Zod parse 失敗 | 視為後端契約破裂，回 `502 BAD_GATEWAY` |
| 客戶端 fetch 失敗 | TanStack Query retry 1 次 + 顯示 Toast/Inline Error |
| 搜尋無結果 | 走 UI「No Result」狀態（Figma frame #4） |

---

## 7. 技術選型摘要

| 層級 | 選用 |
|---|---|
| 前端框架 | Next.js 16（App Router、Turbopack 預設、React Compiler 啟用） |
| React | React 19.2 |
| 語言 | TypeScript |
| 樣式 | TailwindCSS |
| 資料抓取 | TanStack Query（infinite query），搭配 Next.js Cache Components |
| 驗證 | Zod |
| 測試 | Vitest（unit）+ Playwright（e2e） |
| Lint/Format | ESLint + Prettier |
| 套件管理 | pnpm |

> 詳細決策依據見專案根 `/docs/decisions/`（ADR）。

### Next.js 16 採用的新特性

- **Cache Components**（`use cache` 指令 + PPR）：在 BFF 層用來宣告可快取的 RSC 與資料獲取邊界，前端列表頁可直接用 cache directive 控制
- **Turbopack（預設）**：`next dev` 啟動約 4 倍快、render 約 50% 快
- **React Compiler**：自動 memoization，元件不需手動 `useMemo` / `useCallback`
- **`updateTag()` / `refresh()`**：搜尋結果 invalidate 與 SWR 行為更直覺

---

## 8. SPA 導航、scroll 還原、跨頁 state

頁面切換是 SPA（Next 叫 soft navigation），按返回會記憶 scroll 與 tab — 這不是我們刻的，是 Next.js App Router runtime 預設行為 + URL searchParams 的協作結果。

詳細機制（含與其他 SPA framework 對照、useUrlSync 的 guard 邏輯、未來失敗場景緩解）見：[navigation-and-state.md](./navigation-and-state.md)。

---

最後更新：2026-06-14
