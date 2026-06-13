# Spec 001：BFF 基礎建設

- **狀態**：Draft
- **建立日期**：2026-06-13
- **影響範圍**：`frontend/src/app/api/*`、`frontend/src/lib/{api,session,security,schemas,errors,config,mock,log}/*`
- **依賴**：
  - 專案根 ADR 002（Backend = Fastify + BFF 分層）
  - 專案根 ADR 004（Auth Token Strategy：access 3h / refresh 30d / Redis-only / rotation + replay detect）
  - `backend/docs/specs/001-environment-config.md` §3.4 JWT 參數
  - `backend/docs/specs/005-error-handling.md`（錯誤碼前綴與 `AUTH_TOKEN_EXPIRED` 信號）

> 本 spec **僅定義基礎建設模組**（橫切關注點）。**不**含任何業務邏輯。業務 endpoint 規格另寫於後續 spec。

---

## 1. 目的與範圍

定義 Next.js BFF 層的**實作契約**，使任何 Route Handler 實作時不需重新決策橫切議題。

**範圍內**
- `src/app/api/*/route.ts` 的**通用模式**與 `createRoute` wrapper
- `src/app/api/csrf/route.ts`、`src/app/api/health/route.ts`（基礎設施端點）
- `src/lib/api/*`（`backendFetch`、`createRoute`、`okResponse`、`parseBody`、`parseQuery`、常數、request-id、http-status）
- `src/lib/session/*`（Browser ↔ BFF 的 session cookie 處理；含 access + refresh token 與 csrfToken）
- `src/lib/security/*`（CSRF 驗證、origin 白名單）
- `src/lib/schemas/`（共用 schema：envelope、pagination；個別資源 schema 在業務 spec）
- `src/lib/errors/*`（錯誤類別、HTTP 對映）
- `src/lib/config.ts`（環境變數讀取 + Zod 驗證）
- `src/lib/log.ts`（結構化日誌 + 敏感資料遮罩）
- `src/lib/mock/*`（dispatch 機制，不含具體 fixture）

**範圍外**
- 任何 resource 的 schema、endpoint、fixture
- OAuth 登入 flow、token 簽發
- UI 元件、客戶端 fetch
- 真後端內部實作

---

## 2. 認證邊界（cookie ↔ JWT）

BFF 在兩條認證邊界之間轉譯：

```
[Browser]
   │
   │  httpOnly session cookie（Set-Cookie: <name>=<encrypted>; HttpOnly; Secure; SameSite=Lax）
   │  + X-CSRF-Token header（unsafe method only，見 §4）
   ▼
[Next.js BFF]   ← 解密 session、取 access token；驗證 CSRF
   │
   │  Authorization: Bearer <accessToken>
   ▼
[Backend (Fastify)]   ← @fastify/jwt 驗證、stateless
```

### 2.1 為何採此分層

| 角色 | 採用 | 原因 |
|---|---|---|
| Browser ↔ BFF | session cookie | CSRF / cookie 政策由 BFF 集中處理，client 不接觸 JWT，token 不落 localStorage |
| BFF ↔ Backend | JWT Bearer | Backend stateless、可重用於 mobile / 第三方 client、橫向擴展不需 sticky session |

### 2.2 Session 結構

```ts
// src/lib/session/types.ts
export type Session = {
  // —— 與 backend 溝通用的 token pair（依 ADR 004） ——
  accessToken: string                // backend 發的 JWT，3h 壽命
  accessTokenExpiresAt: number       // epoch ms，BFF 用來決定何時 refresh
  refreshToken: string               // 30d 壽命，給 BFF 換新 token 用
  refreshTokenExpiresAt: number      // epoch ms

  // —— BFF 顯示用 ——
  user: { id: string; name: string } // 避免每次打 backend 取 profile

  // —— CSRF（見 §4） ——
  csrfToken: string                  // 與 session 同生命週期
}
```

### 2.3 Sliding TTL

session cookie 的 `Max-Age` 在每次成功 request 時延長（slide），由 `setSession` 自動處理。避免使用者活躍時被強迫重登。

### 2.4 各模組責任

| 模組 | 責任 |
|---|---|
| `src/lib/session/*` | session 加解密、`getSession(req)` / `setSession(res, data)` / `destroySession(res)`、自動產 `csrfToken`、sliding TTL |
| `src/lib/api/backend.ts` | 從 session 取 `accessToken` 注入 `Authorization`；過期觸發 refresh（見 §3） |
| `src/lib/security/verifyCsrf.ts` | unsafe method 驗證 `X-CSRF-Token` + Origin |
| Route Handler | 不直接讀 token、不直接 set cookie；皆透過上述模組 |

---

## 3. Token 生命週期（access + refresh）

依 **專案根 ADR 004** 採用 access + refresh 雙 token：

| 項目 | 值 |
|---|---|
| Access token 壽命 | 3 小時 |
| Refresh token 壽命 | 30 天 |
| Refresh rotation | 每次 refresh 都換新 access + refresh；舊 refresh 立即失效 |
| Replay detection | 偵測到舊 refresh 二次使用 → backend 撤銷該 user 全部 refresh，BFF 收到後 `destroySession` |
| Access 緊急撤銷 | backend 用 Redis blacklist（BFF 無需感知，由 backend 401 回應觸發） |

### 3.1 BFF 端 refresh 流程

**`backendFetch` 內部** 在打 backend 前先判斷：

```
if (accessTokenExpiresAt < now + 30s)        // 30s safety margin
    → 走 refresh 流程
else
    → 直接帶現有 accessToken 打
```

### 3.2 Refresh 流程細節

```
1. BFF 對 backend 打 POST /auth/refresh
   body: { refreshToken }
2. Backend 回應分支：
   2a. 200 OK
       body: { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt }
       → BFF setSession(...) 更新 session
       → 用新 accessToken 重打原請求
   2b. 401 UNAUTHORIZED        ← refresh 失效（過期、撤銷、replay 偵測）
       → BFF destroySession
       → 對 client 回 401 UNAUTHENTICATED
   2c. 5xx / timeout
       → 暫時性問題：對 client 回 503 BACKEND_UPSTREAM_ERROR
       → 不 destroySession（讓使用者下次重試）
```

### 3.3 Backend 回 401 的兩種解釋

依 backend spec 005，backend 區分：

| Backend 錯誤碼 | HTTP | BFF 解讀 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` | 401 | access token 過期。**觸發 refresh**，成功後重打原請求；失敗回 401 UNAUTHENTICATED |
| `UNAUTHORIZED` | 401 | token 無效（簽章錯 / 被 blacklist / 缺漏）。**不**觸發 refresh，直接 `destroySession` 回 401 |

**重要：絕不對通用 401 觸發 refresh** —— 必須明確判斷 `error.code === 'AUTH_TOKEN_EXPIRED'`。否則會浪費 refresh token 且掩蓋 token 被撤銷的訊號。

### 3.4 並發 Refresh 去重（critical）

並發請求 A、B、C 同時遇 `AUTH_TOKEN_EXPIRED`，若各自打 `/auth/refresh`，因 rotation 機制只有第一個會成功；其餘三個會用「已輪換的舊 refresh」被 backend 視為 replay → 全部 session 被撤銷。

**解法：in-flight refresh promise 去重**

```ts
// src/lib/api/backend.ts（概念）
let inflightRefresh: Promise<Session> | null = null

async function refreshAndUpdateSession(req: Request, currentSession: Session): Promise<Session> {
  if (inflightRefresh) return inflightRefresh
  inflightRefresh = (async () => {
    try {
      return await doRefresh(req, currentSession)
    } finally {
      inflightRefresh = null
    }
  })()
  return inflightRefresh
}
```

> 此 in-flight 變數作用範圍是**單一 Node.js process**。Next.js 在 dev 可能跨 worker；prod 多 instance 不共享（但每個 instance 內仍正確）。跨 instance 並發極低機率觸發 replay 是可接受權衡（接受 ADR 004 的策略）。

### 3.5 BFF Refresh 不輪換 CSRF token

CSRF token 綁 session 生命週期，不綁 access token。Refresh 不重產 CSRF token，避免客戶端頻繁 refetch。CSRF token 僅在 §4.3 列的事件下輪換。

---

## 4. CSRF 防護

採 **Synchronizer Token Pattern**（token 綁 session）+ **Origin / Referer 檢查**（defense in depth）+ **SameSite=Lax cookie**。

### 4.1 方案選擇

| 方案 | 採用？ | 理由 |
|---|---|---|
| **Synchronizer Token（session 內）** | ✅ | 已有加密 session 容器；無需第二顆 cookie；server 端比對最不易失誤 |
| Double-Submit Cookie | ❌ | 需第二顆 non-httpOnly cookie，XSS 攻擊面較大 |
| 純 Origin/Referer | ❌（單獨）| 偶有瀏覽器不送 header；僅作第二道 |
| 僅 SameSite=Lax | ❌（單獨）| Lax 仍允許 top-level GET；部分瀏覽器版本行為不一 |

### 4.2 Token 規格

| 屬性 | 值 |
|---|---|
| 長度 | 32 random bytes → base64url（43 字元） |
| 來源 | `crypto.randomBytes(32)` |
| 儲存 | session 內 `csrfToken` 欄位 |
| 客戶端取得 | `GET /api/csrf` 或 server-rendered HTML 嵌入 |
| 客戶端儲存 | **僅記憶體**（禁 localStorage / sessionStorage） |
| 客戶端傳送 | `X-CSRF-Token` HTTP header（禁 URL / body） |

### 4.3 生命週期

| 階段 | 行為 |
|---|---|
| Session 建立（首次登入） | `setSession` 自動產生 |
| Refresh access token | **不**輪換（見 §3.5） |
| 登入狀態轉換（login / logout / 切換帳號）| **強制輪換** |
| Session 銷毀 | 隨之失效 |

### 4.4 客戶端取得 token

`GET /api/csrf`：

```jsonc
// 200 OK
{ "data": { "csrfToken": "<base64url-43chars>" } }
// 401 UNAUTHENTICATED （無 session）
{ "error": { "code": "UNAUTHENTICATED", ... } }
```

- 不需 CSRF 檢查（chicken-and-egg）
- 需 session（無 session 不可能有 token）
- 客戶端在 hydration / mount 呼叫，並在收到 `403 CSRF_INVALID` 時 refetch

**最佳化**：Server Component 在初次 SSR 嵌入：

```tsx
const session = await getSession(req)
return <meta name="csrf-token" content={session?.csrfToken ?? ''} />
```

### 4.5 客戶端傳送 token

unsafe method（POST / PUT / PATCH / DELETE）**必須**帶 `X-CSRF-Token`。

**約定**：GET handler **必須** idempotent；任何寫入動作必須用 POST/PUT/PATCH/DELETE。違反此約定等於繞過 CSRF 防護。

### 4.6 Server 端驗證

```ts
// src/lib/security/verifyCsrf.ts
import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { CsrfError } from '@/lib/errors/CsrfError'
import { allowedOrigins } from '@/lib/config'
import type { Session } from '@/lib/session/types'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  '/api/csrf',
  '/api/health',
  // OAuth callback 由 state 參數防 CSRF；具體 path 由 auth spec 加入
])

export function verifyCsrf(req: Request, session: Session): void {
  if (SAFE_METHODS.has(req.method)) return
  const path = new URL(req.url).pathname
  if (CSRF_EXEMPT_PATHS.has(path)) return

  const origin = req.headers.get('origin') ?? extractOriginFromReferer(req)
  if (!origin || !allowedOrigins.has(origin)) {
    throw new CsrfError('Invalid origin')
  }
  const provided = req.headers.get('x-csrf-token') ?? ''
  if (!constantTimeEqual(provided, session.csrfToken)) {
    throw new CsrfError('CSRF token mismatch')
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  // 長度先檢避免 timingSafeEqual 拋錯；長度差異本身為公開資訊（token 長度固定）
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
```

---

## 5. 模組結構

```
src/
├── app/
│   └── api/
│       ├── csrf/
│       │   ├── route.ts            # GET /api/csrf
│       │   └── route.test.ts
│       ├── health/
│       │   ├── route.ts            # GET /api/health
│       │   └── route.test.ts
│       └── <resource>/             # 個別 endpoint 由業務 spec 定義
│           ├── route.ts
│           └── route.test.ts
├── lib/
│   ├── api/
│   │   ├── backend.ts              # backendFetch wrapper（注入 JWT、refresh 流程）
│   │   ├── backend.test.ts
│   │   ├── create-route.ts         # createRoute() 高階 wrapper
│   │   ├── create-route.test.ts
│   │   ├── responses.ts            # okResponse(data, meta?) 等
│   │   ├── parsers.ts              # parseBody / parseQuery / parsePathParam
│   │   ├── parsers.test.ts
│   │   ├── request-id.ts
│   │   ├── http-status.ts
│   │   └── constants.ts            # timeout、cache TTL、token length 等
│   ├── session/
│   │   ├── session.ts              # get/set/destroy；自動 csrfToken；sliding TTL
│   │   ├── session.test.ts
│   │   └── types.ts                # Session 型別
│   ├── security/
│   │   ├── verifyCsrf.ts
│   │   ├── verifyCsrf.test.ts
│   │   └── origin.ts               # allowedOrigins、extractOriginFromReferer
│   ├── schemas/
│   │   ├── envelope.ts             # SuccessEnvelope / ErrorEnvelope
│   │   ├── pagination.ts           # CursorPage
│   │   └── <resource>.ts           # 個別資源 schema 由業務 spec 定義
│   ├── errors/
│   │   ├── BffError.ts             # base class + 錯誤碼 type
│   │   ├── BackendUpstreamError.ts
│   │   ├── BackendTimeoutError.ts
│   │   ├── ContractViolationError.ts
│   │   ├── UnauthenticatedError.ts
│   │   ├── ValidationError.ts
│   │   ├── CsrfError.ts
│   │   ├── NotFoundError.ts
│   │   └── toErrorResponse.ts
│   ├── config.ts                   # 環境變數 Zod 驗證（含 conditional required）
│   ├── log.ts                      # 結構化日誌 + 遮罩
│   └── mock/
│       ├── dispatch.ts             # registerMock / resolveMock
│       └── <resource>.ts           # 個別 fixture 由業務 spec 定義
└── tests/
    └── helpers/
        ├── session.ts              # withSession(data) → 偽造帶 session 的 Request
        ├── csrf.ts                 # csrfHeader(token)
        └── backend-mock.ts         # 設定 MSW handler 的薄包裝
```

> 約定：`src/lib/api/`、`src/lib/session/`、`src/lib/security/`、`src/lib/config.ts`、`src/lib/log.ts`、`src/lib/mock/`、`src/app/api/` 皆 **server-only**。檔頂第一行 `import 'server-only'`。

### 5.1 Next.js Request 型別約定

統一使用 Web 標準 `Request`。需 `cookies()` / `geo` 等 Next.js 特殊欄位時用 `NextRequest`，並在該 handler 註明原因。

---

## 6. 請求 / 回應契約

### 6.1 成功 envelope

```jsonc
{ "data": { /* 業務資料 */ } }

// 列表 + 游標分頁
{
  "data": { "items": [...], "nextCursor": "..." | null },
  "meta": { "count": 20 }
}
```

### 6.2 錯誤 envelope

```jsonc
{
  "error": {
    "code": "BACKEND_TIMEOUT",
    "message": "Upstream request timed out after 5000ms",
    "requestId": "req_2026-06-13_abc123"
  }
}
```

### 6.3 為何 envelope

- client fetch wrapper 統一判斷 `data` vs `error`
- 加 `meta` 不破壞契約
- 與 TanStack Query 的 `select` 解耦乾淨

### 6.4 共用 schema

```ts
// src/lib/schemas/envelope.ts
import { z } from 'zod'
export const ErrorPayload = z.object({ code: z.string(), message: z.string(), requestId: z.string() })
export function SuccessEnvelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data, meta: z.record(z.string(), z.unknown()).optional() })
}
export const ErrorEnvelope = z.object({ error: ErrorPayload })

// src/lib/schemas/pagination.ts
export const CursorPage = z.object({
  items: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
})
```

---

## 7. 錯誤協定

### 7.1 錯誤碼

| code | HTTP | 觸發情境 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 客戶端入參 Zod parse 失敗 |
| `UNAUTHENTICATED` | 401 | session 缺失 / 解密失敗 / refresh 失敗 |
| `CSRF_INVALID` | 403 | CSRF token 缺/錯 / origin 不在白名單 |
| `NOT_FOUND` | 404 | 真後端回 404 |
| `PAYLOAD_TOO_LARGE` | 413 | request body > 1MB（見 §10.2） |
| `BACKEND_TIMEOUT` | 504 | 真後端逾時 |
| `BACKEND_UPSTREAM_ERROR` | 502 | 真後端 5xx / 連線失敗 / DNS / JSON parse 失敗 |
| `CONTRACT_VIOLATION` | 502 | 真後端回應 schema parse 失敗 |
| `INTERNAL_ERROR` | 500 | 未預期錯誤（catch-all） |

> 與 backend `005-error-handling.md` 對齊：backend 的 `AUTH_TOKEN_EXPIRED` / `UNAUTHORIZED` 在 BFF 邊界轉譯為 `UNAUTHENTICATED`（client 視角不需區分），但**內部**邏輯依 §3.3 嚴格分流。

### 7.2 Error class 階層

```ts
// src/lib/errors/BffError.ts
export type BffErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'CSRF_INVALID' | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE' | 'BACKEND_TIMEOUT' | 'BACKEND_UPSTREAM_ERROR'
  | 'CONTRACT_VIOLATION' | 'INTERNAL_ERROR'

export class BffError extends Error {
  constructor(
    public readonly code: BffErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly cause?: unknown,
  ) { super(message) }
}

// 各派生 class 將 code/httpStatus 寫死
export class BackendTimeoutError extends BffError { /* 504, BACKEND_TIMEOUT */ }
export class BackendUpstreamError extends BffError { /* 502, BACKEND_UPSTREAM_ERROR */ }
export class ContractViolationError extends BffError { /* 502, CONTRACT_VIOLATION */ }
export class ValidationError extends BffError { /* 400, VALIDATION_ERROR */ }
export class UnauthenticatedError extends BffError { /* 401, UNAUTHENTICATED */ }
export class CsrfError extends BffError { /* 403, CSRF_INVALID */ }
export class NotFoundError extends BffError { /* 404, NOT_FOUND */ }
export class PayloadTooLargeError extends BffError { /* 413, PAYLOAD_TOO_LARGE */ }
```

### 7.3 統一映射

```ts
// src/lib/errors/toErrorResponse.ts
export function toErrorResponse(err: unknown, requestId: string): Response {
  if (err instanceof BffError) {
    return Response.json(
      { error: { code: err.code, message: err.message, requestId } },
      { status: err.httpStatus },
    )
  }
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } },
    { status: 500 },
  )
}
```

handler 不在內部判斷錯誤型別；由 `createRoute` wrapper（§9）統一 catch 後交給 `toErrorResponse`。

---

## 8. backendFetch

### 8.1 行為規範

`src/lib/api/backend.ts` 提供 `backendFetch<T>(req, path, options)`：

| 行為 | 規則 |
|---|---|
| Base URL | `env.BACKEND_API_URL`；未設定且 `USE_MOCK !== '1'` → 啟動時拒絕（§13） |
| Timeout | 預設 5000ms (`AbortSignal.timeout`)，可 `options.timeoutMs` 覆寫 |
| Retry | **不**自動 retry |
| 認證標頭 | 從 `req` 取 session 中 `accessToken` 注入 `Authorization: Bearer <token>` |
| Access token pre-emptive refresh | `accessTokenExpiresAt < now + 30s` → 先走 refresh 流程（§3.1） |
| Backend 401 `AUTH_TOKEN_EXPIRED` | 走 refresh 流程後重打一次原請求；refresh 失敗則 401 UNAUTHENTICATED |
| Backend 401 `UNAUTHORIZED` | **不** refresh，`destroySession` + 401 |
| 並發 refresh | 同一 process 內共用 in-flight promise（§3.4） |
| Request ID | 產 `req_<date>_<rand>`，注入 `x-request-id` |
| 連線失敗 / DNS / JSON parse 失敗 | `BACKEND_UPSTREAM_ERROR (502)` |
| Timeout | `BACKEND_TIMEOUT (504)` |
| 回應解析 | `await res.json()`；不做 Zod parse（呼叫端決定 schema） |

### 8.2 簽名

```ts
export async function backendFetch<T = unknown>(
  req: Request,
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    query?: Record<string, string | number | undefined>
    timeoutMs?: number
    headers?: Record<string, string>
    /** 設 true 時不讀 session、不附 Authorization（公開 endpoint） */
    anonymous?: boolean
  },
): Promise<{ data: T; requestId: string }>
```

### 8.3 Mock 模式

`USE_MOCK=1` 時不打網路，改用 §10 的 mock dispatch。CSRF 仍照常檢查（保持安全模式一致）。

---

## 9. Route Handler wrapper（`createRoute`）

集中 try/catch + getSession + verifyCsrf + body/query parse + logging + toErrorResponse，避免每個 handler 重複 boilerplate。

### 9.1 簽名

```ts
// src/lib/api/create-route.ts
type RouteHandlerArgs<TBody, TQuery, TParams, TRequireAuth extends boolean> = {
  req: Request
  requestId: string
  body: TBody
  query: TQuery
  params: TParams
  session: TRequireAuth extends true ? Session : Session | null
}

export function createRoute<TBody, TQuery, TParams, TRequireAuth extends boolean = false>(opts: {
  requireAuth?: TRequireAuth                      // 預設 false（公開 endpoint）
  bodySchema?: ZodType<TBody>                     // 不傳則 body = undefined
  querySchema?: ZodType<TQuery>                   // 不傳則 query = undefined
  paramsSchema?: ZodType<TParams>                 // 動態路由 params 必填用
  cache?: 'no-store' | { revalidate: number; tags?: string[] }
  handler: (args: RouteHandlerArgs<TBody, TQuery, TParams, TRequireAuth>) => Promise<Response> | Response
}): (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
```

### 9.2 wrapper 行為

按順序執行（任一失敗 → 走 `toErrorResponse`）：

1. 產 `requestId`、`log.info('bff.request.in', ...)`
2. 動態 params parse（若有 `paramsSchema`）→ 失敗 `VALIDATION_ERROR`
3. Query parse（若有 `querySchema`）→ 失敗 `VALIDATION_ERROR`
4. 讀 session
5. 若 `requireAuth: true` 且無 session → `UnauthenticatedError`
6. unsafe method（POST/PUT/PATCH/DELETE）→ `verifyCsrf(req, session)`
7. Body parse（若有 `bodySchema`）→ 失敗 `VALIDATION_ERROR` / `PAYLOAD_TOO_LARGE`
8. 呼叫 `handler(args)` 取得 `Response`
9. 套用 `cache` 設定到回應
10. `log.info('bff.response.out', ...)`
11. 全程 try/catch → `toErrorResponse(err, requestId)`

### 9.3 使用範例

```ts
// src/app/api/<resource>/route.ts （通用範本）
import { createRoute, okResponse } from '@/lib/api'
import { backendFetch } from '@/lib/api/backend'
import { FooResponseSchema, FooQuerySchema } from '@/lib/schemas/foo'

export const GET = createRoute({
  querySchema: FooQuerySchema,
  cache: { revalidate: 60, tags: ['foo:list'] },
  handler: async ({ req, query }) => {
    const { data } = await backendFetch(req, '/<resource>', { query, anonymous: true })
    return okResponse(FooResponseSchema.parse(data))
  },
})

export const POST = createRoute({
  requireAuth: true,
  bodySchema: CreateFooBodySchema,
  cache: 'no-store',
  handler: async ({ req, body }) => {
    const { data } = await backendFetch(req, '/<resource>', { method: 'POST', body })
    // 寫入後 invalidate 列表
    revalidateTag('foo:list')
    return okResponse(FooSchema.parse(data))
  },
})
```

### 9.4 配套 helpers

```ts
// src/lib/api/responses.ts
export function okResponse<T>(data: T, meta?: Record<string, unknown>): Response {
  return Response.json(meta ? { data, meta } : { data }, { status: 200 })
}
```

```ts
// src/lib/api/parsers.ts
const MAX_BODY_BYTES = 1_000_000 // 1MB；超過拋 PayloadTooLargeError
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> { /* ... */ }
export function parseQuery<T>(req: Request, schema: ZodType<T>): T { /* ... */ }
export function parsePathParams<T>(raw: Record<string, string>, schema: ZodType<T>): T { /* ... */ }
```

### 9.5 cache 安全性（critical）

| 規則 | 強制 |
|---|---|
| `requireAuth: true` 與 `cache: { revalidate: ... }` **互斥** | ✅ TypeScript 型別層阻擋 + runtime assertion |
| 任何讀 session 的 handler | 必須 `cache: 'no-store'` |
| 含搜尋 / per-user query 的 handler | 必須 `cache: 'no-store'` |

> 違反此規則 = 可能將 user A 的回應快取後回給 user B。型別與 runtime assert 雙重防護。

---

## 10. Mock 模式

### 10.1 啟用

`USE_MOCK=1` 時，`backendFetch` 經 `src/lib/mock/dispatch.ts` 對應到 fixture。Route Handler 不感知。

### 10.2 Dispatch 機制

```ts
// src/lib/mock/dispatch.ts
type MockHandler = (opts: { query?: Record<string, unknown>; body?: unknown }) => unknown
const registry = new Map<string, MockHandler>()
export function registerMock(path: string, handler: MockHandler) { registry.set(path, handler) }
export function resolveMock(path: string): MockHandler | undefined { return registry.get(path) }
```

業務 fixture 檔需在 app start 階段 **eager import**（建議集中於 `src/lib/mock/index.ts` re-export），避免遲到註冊。

### 10.3 Body 上限

`parseBody` 透過 `Content-Length` 與串流計數雙保險，超過 `MAX_BODY_BYTES`（1MB）拋 `PayloadTooLargeError`。

---

## 11. 驗證邊界（Zod）

### 11.1 四道驗證

| 邊界 | 對象 | 失敗 → |
|---|---|---|
| 入站：客戶端參數 | `parseBody` / `parseQuery` / `parsePathParams` | `VALIDATION_ERROR (400)` |
| 入站：session 結構 | 解密後的 session | `UNAUTHENTICATED (401)` |
| 入站：CSRF | `X-CSRF-Token` + Origin | `CSRF_INVALID (403)` |
| 出站：真後端回應 | `await res.json()` 結果 | `CONTRACT_VIOLATION (502)` |

### 11.2 Schema 約定

- 共用：`envelope.ts`、`pagination.ts`
- 個別資源：業務 spec 在 `src/lib/schemas/<resource>.ts` 定義，匯出 `z.infer` 型別
- UI / handler / `backendFetch` 呼叫端共用同一個 schema，禁止平行宣告

---

## 12. 快取策略

### 12.1 預設

Next.js 16 的 fetch 預設**不** cache。透過 `createRoute` 的 `cache` 欄位明確指定。

### 12.2 約定

| Endpoint 類型 | 策略 |
|---|---|
| 公開列表（不依 session） | `{ revalidate: 60, tags: ['<resource>:list'] }` |
| 公開詳細頁 | `{ revalidate: 300, tags: ['<resource>:{id}'] }` |
| 含搜尋參數（`q`） | `'no-store'` |
| 任何讀 session 的 endpoint | `'no-store'` |
| 寫入操作 | `'no-store'`，handler 內 `revalidateTag(...)` |

### 12.3 Tag 命名與失效

```
<resource>:list
<resource>:{id}
```

寫入後在 handler 內：

```ts
import { revalidateTag } from 'next/cache'
revalidateTag('foo:list')
```

---

## 13. 環境變數

### 13.1 Zod 驗證與條件式必填

```ts
// src/lib/config.ts
import 'server-only'
import { z } from 'zod'

const RawEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BACKEND_API_URL: z.string().url().optional(),
  USE_MOCK: z.enum(['0', '1']).default('0'),
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_COOKIE_NAME: z.string().default('jko_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  ALLOWED_ORIGINS: z.string().optional(),
  APP_VERSION: z.string().default('0.0.0'),       // 給 /api/health 用
  APP_COMMIT: z.string().optional(),              // 給 /api/health 用
  NEXT_PUBLIC_APP_NAME: z.string().default('JKODonation'),
}).superRefine((env, ctx) => {
  // USE_MOCK=0 時：BACKEND_API_URL 與 SESSION_SECRET 必填
  if (env.USE_MOCK === '0') {
    if (!env.BACKEND_API_URL) ctx.addIssue({ code: 'custom', path: ['BACKEND_API_URL'], message: 'required when USE_MOCK=0' })
    if (!env.SESSION_SECRET)  ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'],  message: 'required when USE_MOCK=0' })
  }
  // production 不允許 ALLOWED_ORIGINS 為空或僅含 localhost
  if (env.NODE_ENV === 'production') {
    const list = (env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (list.length === 0 || list.every(o => o.startsWith('http://localhost'))) {
      ctx.addIssue({ code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'production requires non-localhost origins' })
    }
  }
})

export const env = RawEnv.parse(process.env)
export const allowedOrigins = new Set(
  (env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),
)
```

驗證失敗 = 啟動拒絕，**不**讓服務帶錯設定上線。

### 13.2 變數清單

| 變數 | 範圍 | 必填條件 | 預設 | 用途 |
|---|---|---|---|---|
| `NODE_ENV` | server | 必（Next.js 自動）| `development` | 環境模式 |
| `BACKEND_API_URL` | server | `USE_MOCK=0` 時必填 | — | BFF → backend base URL |
| `USE_MOCK` | server | — | `'0'` | `'1'` 走 mock fixture |
| `SESSION_SECRET` | server | `USE_MOCK=0` 時必填 | — | session 加密金鑰（≥ 32 字元） |
| `SESSION_COOKIE_NAME` | server | — | `jko_session` | session cookie 名稱 |
| `SESSION_TTL_SECONDS` | server | — | `604800`（7d）| session 存活秒數 |
| `ALLOWED_ORIGINS` | server | production 必且非僅 localhost | `http://localhost:3000` | CSRF Origin 白名單 |
| `APP_VERSION` | server | — | `0.0.0` | `/api/health` 回傳用 |
| `APP_COMMIT` | server | — | — | `/api/health` 回傳用 |
| `NEXT_PUBLIC_APP_NAME` | client + server | — | `JKODonation` | UI 顯示用 |

`.env.example` 同步更新。

---

## 14. 日誌 / Observability

### 14.1 結構化欄位

| 欄位 | 必含 | 說明 |
|---|---|---|
| `level` | ✅ | `info` / `warn` / `error` |
| `requestId` | ✅ | 串連 BFF + backend 日誌 |
| `event` | ✅ | `bff.request.in` / `bff.upstream.ok` / `bff.upstream.error` / `bff.csrf.rejected` / `bff.response.out` |
| `path`, `method` | request/response | |
| `status`, `durationMs` | response | |
| `upstreamPath`, `upstreamStatus`, `upstreamCode` | upstream | |
| `userId` | 有 session 時 | |

### 14.2 遮罩規則（自動套用，由 `log.ts` 集中）

| 內容 | 遮罩方式 |
|---|---|
| `Authorization` header / accessToken / refreshToken | 只記前 8 字元 + `...`（不可全字串） |
| `X-CSRF-Token` | 只記長度與是否存在，不記內容 |
| session cookie 加密字串 | 完全不 log |
| OAuth `state` | 只記長度 |
| 使用者 email、姓名（若未來出現） | 雜湊或 redacted |
| Internal error stack trace | 完整記入 server log；**不**回傳到 client envelope |
| Upstream error message | 摘要記入 server log；不洩漏 backend 內部訊息給 client |

### 14.3 MVP 實作

可先 `console.log(JSON.stringify(...))`；接 backend 後換 `pino`，串 trace ID。

---

## 15. 測試模式

> 本節定義**模式**；個別 endpoint 案例由業務 spec 列出。

### 15.1 Route Handler 通用測試清單

每個 handler 至少：

| # | 案例 | 斷言 |
|---|---|---|
| 1 | Happy path | envelope 結構、HTTP 200 |
| 2 | Backend 5xx | `BACKEND_UPSTREAM_ERROR` + 502 |
| 3 | Backend timeout | `BACKEND_TIMEOUT` + 504 |
| 4 | Backend 回非預期格式 | `CONTRACT_VIOLATION` + 502 |
| 5 | 連線失敗 / DNS 錯 | `BACKEND_UPSTREAM_ERROR` + 502 |
| 6（需 auth）| 未帶 session | `UNAUTHENTICATED` + 401 |
| 7（需 auth）| AUTH_TOKEN_EXPIRED → refresh 成功 → 重打 | 200 |
| 8（需 auth）| AUTH_TOKEN_EXPIRED → refresh 失敗 | `UNAUTHENTICATED` + 401 + cookie 清除 |
| 9（需 auth）| Backend 回 UNAUTHORIZED（非 EXPIRED）| `UNAUTHENTICATED` + 401 + cookie 清除（**不**觸發 refresh） |
| 10（unsafe method）| 未帶 X-CSRF-Token | `CSRF_INVALID` + 403 |
| 11（unsafe method）| Token 錯 | `CSRF_INVALID` + 403 |
| 12（unsafe method）| Origin 不在白名單 | `CSRF_INVALID` + 403 |
| 13 | Body > 1MB | `PAYLOAD_TOO_LARGE` + 413 |

### 15.2 `backendFetch` 測試

- timeout、non-2xx、連線失敗、DNS 失敗、JSON parse 失敗 → 對應錯誤型別
- mock 模式經 dispatch 取得 fixture；未註冊 path → `BackendUpstreamError`
- `anonymous: true` 時不讀 session
- session 存在時注入 `Authorization`
- access pre-emptive refresh（剩餘 < 30s）
- `AUTH_TOKEN_EXPIRED` → refresh 流程
- `UNAUTHORIZED` → 不 refresh，直接拋
- **並發 refresh 去重**：mock 兩個 request 同時觸發，斷言只打 `/auth/refresh` 一次

### 15.3 `session` 測試

- `setSession` → `getSession` round-trip
- 損壞 / 簽章錯 → `getSession` 回 `null`
- `destroySession` 清除 cookie
- 自動產 `csrfToken`（長度 43、base64url）
- sliding TTL：`getSession` 後 cookie `Max-Age` 重新計算

### 15.4 `verifyCsrf` 測試

| 案例 | 期望 |
|---|---|
| Safe method | 通過 |
| 豁免路徑 | 通過 |
| 無 Origin 且無 Referer | `CsrfError` |
| Origin 不在白名單 | `CsrfError` |
| 無 X-CSRF-Token | `CsrfError` |
| Token 長度錯 | `CsrfError`（不可拋 native 例外）|
| Token 內容錯 | `CsrfError` |
| Origin + token 正確 | 通過 |

### 15.5 `createRoute` 測試

- 順序：params → query → auth → csrf → body → handler
- 任一階段失敗的錯誤碼正確
- `requireAuth: true` + `cache: { revalidate }` → 型別錯 / runtime assert 失敗
- handler 拋出非 BffError → 回 `INTERNAL_ERROR`

### 15.6 `errors` / `config` / `/api/csrf` / `/api/health` 測試

- `toErrorResponse`：所有錯誤碼的 status + envelope 正確；未知錯誤 fallback `INTERNAL_ERROR`
- `config`：必填變數缺漏 → throw；production 的 `ALLOWED_ORIGINS` 守門；`USE_MOCK=0` 條件式必填
- `/api/csrf`：無 session → 401；有 session → 回 `csrfToken`
- `/api/health`：回 `{ status: 'ok', uptime, version, commit }`，**不**洩漏內部資訊

### 15.7 測試輔助（`tests/helpers/`）

```ts
// tests/helpers/session.ts
export function withSession(req: Request, data: Partial<Session>): Request { /* 偽造帶 session cookie 的 Request */ }
// tests/helpers/csrf.ts
export function csrfHeader(token: string): HeadersInit { return { 'x-csrf-token': token, 'origin': 'http://localhost:3000' } }
// tests/helpers/backend-mock.ts
export function mockBackend(handler: (req: Request) => Promise<Response>): void { /* 設 MSW handler */ }
```

### 15.8 覆蓋率目標

| 範圍 | 目標 |
|---|---|
| `src/lib/` | ≥ 90% lines |
| `src/app/api/` | ≥ 85% lines |

CI 不設硬性 fail 門檻（短工期），但 PR 報告覆蓋率變化。

---

## 16. 不在本 spec 解決（後續）

| 議題 | 後續 spec / ADR |
|---|---|
| Session 加解密實作（`iron-session` vs 自寫） | ADR |
| OAuth 登入流程（Google）、`/auth/google/callback` 對接 | spec：`auth-login.md` |
| Refresh / Logout endpoint 對 backend 的明確契約 | spec：`auth-token-flow.md`（與 backend 同步） |
| 個別 resource 的 schema、endpoint、mock fixture、tag | 個別業務 spec |
| Rate limit（BFF 端） | 基礎建設後補 |
| Idempotency-Key for writes（轉發 backend） | 寫入操作 spec |
| Streaming / WebSocket / SSE | 無此需求 |
| Cache Components / `use cache` 在 RSC 細部使用 | UI spec |

---

## 17. 驗收條件

當以下都成立時，本 spec 視為**已實作**：

- [ ] `src/lib/config.ts`：env Zod 驗證、conditional required（USE_MOCK / production）、`allowedOrigins` 解析
- [ ] `src/lib/session/*`：set/get/destroy round-trip + 損壞 cookie + 自動 csrfToken + sliding TTL 測試通過
- [ ] `src/lib/security/verifyCsrf.ts`：§15.4 所有案例通過
- [ ] `src/lib/api/backend.ts`：§15.2 所有案例通過（含並發 refresh 去重）
- [ ] `src/lib/api/create-route.ts`：§15.5 所有案例通過；type-level `requireAuth` × `revalidate` 互斥已驗證
- [ ] `src/lib/api/{responses,parsers,request-id,http-status,constants}.ts` 全數存在 + 測試
- [ ] `src/lib/errors/*`（含 `CsrfError`、`PayloadTooLargeError`）+ `toErrorResponse` 通過所有錯誤碼測試
- [ ] `src/lib/schemas/envelope.ts`、`pagination.ts` 通過 happy + edge case
- [ ] `src/lib/mock/dispatch.ts`：register / resolve / 未註冊三類測試
- [ ] `src/lib/log.ts`：JSON 格式 + 敏感欄位遮罩（含 `Authorization` 前 8 字元、`X-CSRF-Token` 只記長度）測試
- [ ] `src/app/api/csrf/route.ts`、`src/app/api/health/route.ts` 通過 §15.6 案例
- [ ] `.env.example` 同步包含本 spec §13.2 所有變數
- [ ] **無業務字眼自檢**：`grep -rE "charity|donation|jko[^_]" src/lib/{api,session,security,errors,config,mock,log,schemas/{envelope,pagination}}` 應無命中（business resource 字眼僅可出現於業務 spec 對應檔案）
- [ ] 文件回填：本 spec §16 在實作時若有變動需 PR 同步更新

---

最後更新：2026-06-13
