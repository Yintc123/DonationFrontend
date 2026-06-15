# Spec 006：Global Error Toast（client → user）

- **狀態**：Draft（v0.4 — 撤回 Toaster offset 嘗試，回到 top-center 預設）
- **建立日期**：2026-06-15
- **路徑**：
  - `src/lib/errors/HttpClientError.ts` / `.test.ts`（client 端 status-bearing error）
  - `src/lib/errors/globalQueryError.ts` / `.test.ts`（QueryCache `onError` / `onSuccess` handler）
  - `src/app/providers.tsx`（QueryClient + `<Toaster />` 掛載點）
- **依賴**：
  - [sonner](https://sonner.emilkowal.ski) 2.x（已加進 dependencies）
  - 既有 BFF 錯誤映射（[BffError + toErrorResponse](../../src/lib/errors/)）
  - 既有 per-section `<InlineError>`（[003h](./003h-inline-error.md)）

---

## 1. 職責

當 client-side fetch（TanStack Query 走的請求）拿到 backend 5xx，**全局**提示「server 目前維修中…」，並避免「同一次操作打 N 個請求 → 跳 N 個 toast」。

非 5xx（4xx / 422 / 401 etc.）**不** toast；交給該區塊的 [`<InlineError>`](./003h-inline-error.md) 顯示「載入失敗 + 重試」按鈕。

---

## 2. 決策

### 2.1 為何選 sonner

| 方案 | 優點 | 缺點 |
|---|---|---|
| **sonner**（選用）| App Router 友善、~5KB、built-in `id` upsert dedup、無障礙（`role="status"` + `aria-live`）、視覺成熟 | 多一個 dep |
| react-hot-toast | 同上、社群大 | 同上 |
| 手刻 ToastContext + Map\<id, msg\> | 無 dep | a11y / 動畫 / 多 toast 排版要自己處理 ~80 行 |
| Inline banner（非 toast） | 不會被忽略 | 跨頁狀態保存麻煩、視覺侵入 |

選 sonner 是「最小工作量 × 最高完成度」的交集。

### 2.2 為何用「stable id 自然 dedup」而非 throttle / debounce

sonner（及 react-hot-toast）的 toast API 接 `{ id }`，**同 id 第二次呼叫會 upsert 既有 toast 而非堆疊**。一次操作 fan-out 5 個請求同時 5xx → 5 次 `toast.error(msg, { id: 'server-5xx' })` → 畫面上仍是 1 個 toast。

優於手動 throttle / debounce：
- 不需 timer 狀態管理
- 第 5 個請求若拖到第 4 個之後 toast 已自然消失，重新出現也是 1 個
- 程式碼最簡單

### 2.3 5xx 才 toast；4xx 留給 InlineError

- 5xx 是「整個 server 出狀況」，使用者**怎麼操作都不會好**，要全局醒目提示
- 4xx 通常是「這個 query 的問題」（id 不存在、參數不對），該區塊出 `<InlineError>` 含 retry / 引導使用者調整輸入比較合理
- 多重 toast（4xx 也 toast）會造成「整個 app 都壞了」的錯覺

未來若新增 401 → 提示「請重新登入」是合理擴張，但用**另一個** `id`（e.g. `'auth-401'`），跟 5xx 各自 dedup。

### 2.4 為何 RSC 端的 5xx 不走本機制

詳細頁是 RSC，`fetchCharityDetail` 等 server-side fetcher 失敗不會經過 client `QueryCache`，沒辦法觸發 sonner toast。RSC 失敗的處理路徑：

| RSC 錯誤 | 處理 |
|---|---|
| 404 (`NotFoundError`) | `notFound()` → Next 404 page |
| 其他 | 拋到 Next.js 的 `error.tsx` boundary（目前未實作；fallback default error） |

跨 RSC / client 一致的 5xx 提示需要兩個機制聯動，scope 太大，本 spec v0.1 不做。

### 2.5 InlineError 不替換

`<InlineError>`（[003h](./003h-inline-error.md)）仍是「該區塊重試」的入口：

```
[整個畫面右上角] 🔴 server 目前維修中…           ← 全局 toast（sonner）

[列表區塊]
   [icon] 載入失敗，請稍候再試           ← <InlineError>
   [   重試   ]
```

兩者互補：toast 告知「server 壞了，不只是這個 list」；InlineError 給「server 修好後再 retry」的直接路徑。

---

## 3. API

### 3.1 `HttpClientError`

```ts
// src/lib/errors/HttpClientError.ts
export class HttpClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpClientError'
  }
}
```

由 `useResourceListInfinite` 的 queryFn 在 `!res.ok` 時 throw。後續加 client-side mutation 也應 throw 這個（讓 global handler 能讀到 status）。

### 3.2 `getHttpStatus(error: unknown): number | null`

Best-effort status 萃取，給 global handler 用。回 `null` 代表「我不確定，請不要 toast」：

| 輸入 | 回傳 |
|---|---|
| `HttpClientError` | `error.status` |
| 物件含 `.status: number`（彈性給未來其他 fetcher） | `.status` |
| `Error` / string / null / undefined / 其他 | `null` |

### 3.3 `handleGlobalQueryError(error: unknown): void`

```ts
export const SERVER_5XX_TOAST_ID = 'server-5xx'
export const SERVER_5XX_TOAST_DURATION_MS = 3000

export function handleGlobalQueryError(error: unknown): void {
  const status = getHttpStatus(error)
  if (status !== null && status >= 500) {
    toast.error('server 目前維修中…', {
      id: SERVER_5XX_TOAST_ID,
      duration: SERVER_5XX_TOAST_DURATION_MS,
    })
  }
}
```

> v0.2: `duration` 從 5s 縮為 3s；同時 `<Toaster closeButton />` 給使用者主動 X 關閉。三個 dismiss 入口並存：（1）3s 自動消、（2）使用者按 X、（3）`handleGlobalQuerySuccess` 在下個成功請求 dismiss。

接到 `QueryCache` 與 `MutationCache` 的 `onError`。非 5xx / 無 status 一律不做事。

### 3.4 `handleGlobalQuerySuccess(): void`

```ts
export function handleGlobalQuerySuccess(): void {
  toast.dismiss(SERVER_5XX_TOAST_ID)
}
```

接到 `onSuccess`：server 恢復後第一個成功的請求會把 banner 收掉，不用等 toast 自然 timeout。

### 3.5 Providers 串接

```tsx
// src/app/providers.tsx
const [client] = useState(() => new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalQueryError,
    onSuccess: handleGlobalQuerySuccess,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalQueryError,
    onSuccess: handleGlobalQuerySuccess,
  }),
  defaultOptions: { /* ... 既有 */ },
}))

return (
  <QueryClientProvider client={client}>
    <InAppNavProvider>{children}</InAppNavProvider>
    <Toaster richColors position="top-center" closeButton />
  </QueryClientProvider>
)
```

`<Toaster />` 在 `<Providers>` 內 mount 一次；`toast()` 可從任何 client component 呼叫。`closeButton` 給每個 toast 一個 X，使用者隨時可手動關閉（v0.2）。

### 3.5 Toast 與 InlineError 的版面配置（v0.4 — 簡化）

5xx 發生時畫面上會同時出現 **toast**（全局）與 list panel 內的 **`<InlineError>`**（重試入口）。最終配置走「toast top-center / error 區塊中心」自然分離：

| 元素 | 位置 |
|---|---|
| `<InlineError>` | list panel 內 **V+H 置中**：error case 包一層 `flex-1 flex items-center justify-center px-...`，跟 `<Spinner>` 的 isLoading 寫法一致；垂直約落在 viewport `~50%` |
| Toast (`<Toaster>`) | sonner 預設 `position="top-center"`，距 viewport 頂 ~32px。兩者垂直分開、不會互相遮蓋；不再強求視覺上「成對」 |

```tsx
// CharityListShell.ListPanel
if (list.isError) {
  return (
    <div className="flex-1 flex items-center justify-center px-[15px] md:px-6 lg:px-8">
      <InlineError message="載入失敗,請稍候再試" onRetry={list.refetch} />
    </div>
  )
}

// providers.tsx
<Toaster richColors position="top-center" closeButton />
```

> **設計歷史**：v0.3 試過用 `offset="45vh"` 把 toast 拉到 viewport 中央上方（同時補 `mobileOffset` 因為 sonner v2 在 < 600px 改吃獨立 prop）想跟 InlineError 成對顯示，使用者回報該效果不如保留在頂部清楚直覺，v0.4 撤回，回到 sonner 預設位置。InlineError 的 V+H 置中保留——跟 `<Spinner>` 一致、視覺更穩。

---

## 4. 行為矩陣

| 情境 | 5xx 來源 | 預期 |
|---|---|---|
| 切到 donation tab，BFF 回 500 | useResourceListInfinite | 1 個 toast「server 目前維修中…」+ donation 列表區 `<InlineError>` |
| 同個 tab 內 search debounce 連送 3 個 query 全 503 | useResourceListInfinite | 仍**只 1 個** toast（同 id upsert） |
| 切 charity tab + scroll 觸下一頁 + 改 category 同時 500 | useResourceListInfinite × 3 | 仍**只 1 個** toast |
| server 恢復、下一個 query 200 | QueryCache `onSuccess` | toast 主動 dismiss，不用等 3s timeout |
| 使用者按 toast 右上角 X | sonner `closeButton`（v0.2） | toast 立即 dismiss；下次 5xx 還是會再出 |
| 一直沒成功也沒手動關 | duration 3s（v0.2，原 5s） | 自動 dismiss |
| 4xx（unknown category 422、detail 404 etc.） | — | 不 toast；InlineError / notFound() 處理 |
| RSC 詳細頁 5xx | server-side throw | 不 toast；走 Next.js `error.tsx`（目前未實作） |

---

## 5. 測試

### 5.1 `HttpClientError.test.ts`

| # | 案例 | 期望 |
|---|---|---|
| 1 | `new HttpClientError(503, 'x')` | instanceof Error / 自己；status / message / name 正確 |
| 2 | `getHttpStatus(HttpClientError)` | 回 status |
| 3 | `getHttpStatus(new Error('x'))` | `null` |
| 4 | `getHttpStatus(null/undefined/'string')` | `null` |
| 5 | `getHttpStatus({ status: 502 })` | `502`（彈性給未來） |
| 6 | `getHttpStatus({ status: '500' / null })` | `null`（非 number 不收） |

### 5.2 `globalQueryError.test.ts`

| # | 案例 | 期望 |
|---|---|---|
| 1 | 5xx → `toast.error(msg, { id, duration })` 被叫 | 訊息「server 目前維修中…」/ id `server-5xx` / duration `SERVER_5XX_TOAST_DURATION_MS = 3000`（v0.2） |
| 2 | 500/502/503/504/599 都觸發 | each case 1 次 |
| 3 | 400/401/403/404/422 不觸發 | 0 次 |
| 4 | Error / null / undefined / string 不觸發 | 0 次 |
| 5 | 連叫 3 次 5xx → 3 次 toast 呼叫但都用同 id | sonner 端 dedup |
| 6 | `handleGlobalQuerySuccess()` → `toast.dismiss(id)` | OK |

### 5.3 整合 / e2e（後續可加）

目前無 e2e；要驗證需要在 Playwright 用 `page.route()` 把某 BFF 端點改 500，斷言 toast 文字出現。本 spec v0.1 不強制（unit 已覆蓋分支）。

---

## 6. 開放問題

- **401 / auth 失效**：未來補一個 `handleGlobalQueryError` 分支，用 id `'auth-401'`，提示「請重新登入」並 redirect `/`
- **網路斷線（offline）**：browser `navigator.onLine` + `window.addEventListener('online'/'offline')`，提示「沒有網路」用 id `'network-offline'`
- **RSC 5xx → client toast**：要把 server-side 錯誤 marshal 到 client 才能用 sonner，需要 `error.tsx` boundary + 一個 client-side 「告訴 Toaster」的 hook；本 v0.1 不做
- **toast 文字 i18n**：目前 hardcode 中文；i18n 上線後抽 string table
- **可關閉的 server 維修 banner**：sonner 預設可手動關；若維修期長想做「常駐 banner」可改用 `<Banner>` component 替代

---

## 7. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-15 | 初版：5xx 全局 toast（sonner + stable id dedup）+ HttpClientError class + QueryCache/MutationCache wire-up；useResourceListInfinite 改丟 HttpClientError；保留 InlineError 並存；RSC 5xx 暫不涵蓋 |
| 0.2 | 2026-06-15 | UX 微調：`<Toaster closeButton />` 給每個 toast 一個 X 讓使用者主動關閉；duration 從 5s 縮為 3s（常數 `SERVER_5XX_TOAST_DURATION_MS`）。三個 dismiss 入口並存：自動 / 手動 / `onSuccess` |
| 0.3 | 2026-06-15 | 版面配對：`<InlineError>` 在 list panel 用 `flex-1 flex items-center justify-center` V+H 置中（之前是 `pt-[15px]` 貼上緣）；`<Toaster offset="45vh">` 讓 toast 落在 viewport ~45% 處（試過 40vh 偏上、再下移到 45vh），跟置中 InlineError 形成「toast 緊貼 retry 區塊上方」的視覺配對。新增 §3.5 + 標註對其他未來 toast 類型的副作用 |
| 0.4 | 2026-06-15 | 撤回 v0.3 的 Toaster offset 嘗試：使用者實測偏好 toast 留在頂部直覺，回到 sonner 預設 `position="top-center"`，移除 `offset` / `mobileOffset`。`<InlineError>` 的 V+H 置中保留（跟 `<Spinner>` 一致是獨立改善）。§3.5 改寫為「簡化版面」+ 設計歷史備註 |
