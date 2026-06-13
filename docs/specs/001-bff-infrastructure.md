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
- **任何 cache 層**：所有 Response 一律 `Cache-Control: no-store, private`，`backendFetch` 不暴露 fetch data cache 參數。理由見 §12.2；要加 cache 須開新 spec

---

## 2. 認證邊界（cookie ↔ session store ↔ JWT）

BFF 在兩條認證邊界之間轉譯。Session 真相存於 **Redis（server-side）**；cookie 只攜帶不可預測的 sessionId（依 ADR 005 v2、ADR 006）。

```
[Browser]
   │
   │  httpOnly session cookie（Set-Cookie: <name>=<sealed { sessionId }>; HttpOnly; Secure; SameSite=Lax）
   │  + X-CSRF-Token header（unsafe method only，見 §4）
   ▼
[Next.js BFF on Cloud Run]
   │  1. 解 cookie → sessionId
   │  2. SessionStore（Redis）GET session:<sessionId> → StoredSession
   │  3. 取 accessToken；驗證 CSRF
   │
   │  Authorization: Bearer <accessToken>
   ▼
[Backend (Fastify)]   ← @fastify/jwt 驗證、stateless
```

### 2.1 為何採此分層

| 角色 | 採用 | 原因 |
|---|---|---|
| Browser ↔ BFF（cookie） | iron-session 封裝 `{ sessionId }` | client 不接觸 JWT，token 不落 localStorage；ADR 005 v2 |
| BFF（session 真相） | Redis（SessionStore interface） | Cloud Run 多 instance 共享、可立即作廢、跨 instance refresh 協調；ADR 006 |
| BFF ↔ Backend | JWT Bearer | Backend stateless、可重用於 mobile / 第三方 client；ADR 002 |

### 2.2 資料分布

**Cookie 內容**（加密簽章，由 iron-session 處理）：
```ts
// src/lib/session/cookie.ts 內部使用
type CookiePayload = { sessionId: string }   // sessionId: 32 bytes → base64url, 43 字元
```

**Redis 內容**（key: `<REDIS_KEY_PREFIX>:session:<sessionId>`）：
```ts
// src/lib/session/types.ts
export type StoredSession = {
  userId: string                     // 對應 user.id，存頂層便於 SCAN by user
  accessToken: string                // backend 發的 JWT，3h
  accessTokenExpiresAt: number       // epoch ms
  refreshToken: string               // 30d
  refreshTokenExpiresAt: number
  user: { id: string; name: string } // 顯示用快取
  csrfToken: string                  // 43 字元 base64url（見 §4）
  createdAt: number
}
```

> 不存 `lastSeenAt`：Redis TTL 本身就是 sliding 機制，再存欄位等於每次 read 都要 SET，徒增寫放大且無消費者。需要「最後活動時間」時可由 `TTL` 反算（`now - (originalTTL - currentTTL)`）。

> 業務模組（handler、`backendFetch`）僅看到 `StoredSession`；cookie / Redis 細節由 `SessionService` 隱藏。

### 2.3 Sliding TTL（cookie + Redis 雙層）

| 層 | 機制 | 觸發 |
|---|---|---|
| Cookie | iron-session `cookieOptions.maxAge` + `writeSessionId()` 重簽 | `SessionService.touch()` |
| Redis | Lua atomic `EXPIRE`（ADR 006 §5.1.2） | `SessionService.touch()` |

**`get()` 為純讀**：不 slide 任何 TTL，不寫 cookie、不寫 Redis；RSC 與 Route Handler 皆可安全呼叫，且天然冪等（同一 request 多次呼叫的副作用一致 = 無副作用）。

**`touch()` 同步 slide cookie + Redis**：由 `createRoute` 在 response phase 自動呼叫（§9.2 step 10）。兩層共用 `SESSION_TTL_SECONDS`。

#### 2.3.1 為何 `get()` 不做 sliding

兩個獨立理由：

1. **RSC 限制**：Next.js 16 **Server Component** 中 `cookies()` 為唯讀；`cookies().set(...)` 會拋出 `Cookies can only be modified...`。若 `get()` 偷寫 cookie，所有「在 RSC 內取 session 顯示 user 名」的場景都會炸。
2. **避免雙重 slide**：若 `get()` slide Redis、`touch()` 也 slide Redis，則同一 request 內 createRoute step 4（auth check）與 step 10（response phase）會送兩次 `EXPIRE` 給同一 key——純粹浪費。

採用「get() 純讀 / touch() 同步 slide 兩層」後，兩個問題一次解掉。

**邊界後果**：
- 使用者在 RSC 上瀏覽（如 SSR 列表頁）只觸發 `get()`，**兩層 TTL 都不展延**；cookie 與 Redis 條目同步走向過期
- 使用者下一次任何 Route Handler 互動（搜尋、無限滾動、寫入）→ createRoute step 10 自動 `touch()` → 兩層同步展延
- 純看 RSC 不互動 → 最終雙雙過期 = 重新登入（可接受）。對需要展延 RSC-only session 的場景，未來可加 Server Action `keepalive()` 由 client 定時呼叫

### 2.4 各模組責任

| 模組 | 責任 |
|---|---|
| `src/lib/session/cookie.ts` | iron-session 封裝；`readSessionId()` / `writeSessionId(id)` / `clearSessionCookie()` / `newSessionId()`（ADR 005 v2） |
| `src/lib/session/store/*` | `SessionStore` interface + `RedisSessionStore` impl + `InMemorySessionStore`（測試替身）。詳見 ADR 006 §5 |
| `src/lib/session/service.ts` | `SessionService`：組合 cookie + store，提供業務語意 API（`get()` 純讀 / `create()` / `update()` / `destroy()` / `touch()` 同步 slide / `rotateCsrfToken()` / `refresh()`） |
| `src/lib/api/backend.ts` | 接受呼叫端注入的 `StoredSession`；取 `accessToken` 注入 `Authorization`；過期觸發 refresh（見 §3） |
| `src/lib/security/verifyCsrf.ts` | unsafe method 驗證 `X-CSRF-Token` + Origin；route-level 可豁免（§9.1 `csrfExempt`） |
| Route Handler | 不直接讀 cookie / Redis；session 由 `createRoute` 注入 args |

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
       → BFF SessionService.update(newTokens)（cookie sessionId 不變，Redis session 內容更新）
       → 用新 accessToken 重打原請求
   2b. 401 UNAUTHORIZED        ← refresh 失效（過期、撤銷、replay 偵測）
       → BFF SessionService.destroy()
       → 對 client 回 401 UNAUTHENTICATED
   2c. 5xx / timeout
       → 暫時性問題：對 client 回 503 BACKEND_UPSTREAM_ERROR
       → 不 destroy（讓使用者下次重試）
```

### 3.3 Backend 回 401 的兩種解釋

依 backend spec 005，backend 區分：

| Backend 錯誤碼 | HTTP | BFF 解讀 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` | 401 | access token 過期。**觸發 refresh**，成功後重打原請求；失敗回 401 UNAUTHENTICATED |
| `UNAUTHORIZED` | 401 | token 無效（簽章錯 / 被 blacklist / 缺漏）。**不**觸發 refresh，直接 `destroySession` 回 401 |

**重要：絕不對通用 401 觸發 refresh** —— 必須明確判斷 `error.code === 'AUTH_TOKEN_EXPIRED'`。否則會浪費 refresh token 且掩蓋 token 被撤銷的訊號。

### 3.4 並發 Refresh 去重（Cloud Run 跨 instance）— 依 ADR 006

並發請求 A、B、C 同時遇 `AUTH_TOKEN_EXPIRED`，若各自打 `/auth/refresh`，因 rotation 機制只有第一個會成功；其餘被 backend 視為 replay → 全部 session 被撤銷（ADR 004）。

Cloud Run **跨 instance**下，in-process Promise 去重**無效**（每個 instance 有自己的記憶體）。

**解法：Redis 分散式鎖 + fresh-tokens 短期 cache**（詳細流程與 Lua 釋鎖見 ADR 006 §6）。

```
SessionService.refresh(req):
  1. store.getCachedTokens(userId)
     └─ HIT → 用 cached pair 更新 session，回到 backend 重打
  2. lockToken = store.acquireLock('refresh-lock:'+userId, 10s)
     ├─ 取得鎖：
     │   - 再次 getCachedTokens（double-check）
     │   - 打 backend /auth/refresh
     │   - 成功 → setCachedTokens(60s) + 更新 session + releaseLock + 重打
     │   - 401 UNAUTHORIZED → destroySession + 401 + releaseLock
     │   - 5xx / timeout → 不 destroy，回 503 + releaseLock
     └─ 未取得鎖：
         - polling getCachedTokens 每 50ms，最長 8s（= 鎖 TTL × 0.8）
         - 命中 → 用該 pair 更新 session、重打
         - 超時 → 503 BACKEND_UPSTREAM_ERROR + Retry-After
```

| Redis key | TTL | 用途 |
|---|---|---|
| `refresh-lock:<userId>` | 10s | SET NX EX；防同 user 並發 refresh |
| `fresh-tokens:<userId>` | 60s | 剛 refresh 完的新 pair；讓等鎖請求免重打 backend |

> 鎖 TTL = 10s 是「backend refresh p99 (~2s) × 5」safety margin；fresh-tokens 60s 是「足夠覆蓋等鎖請求 + cold start instance」。理由詳見 ADR 006 §6.2 / §6.3。

> **Poller 超時 = 8s（與鎖 TTL 同數量級）**：先前版本設 2s，落入 p99 tail（>2s）時等鎖端會 503，但持鎖端仍會成功 refresh → 等鎖端看到「backend 沒掛卻被打 503」，cold start instance 尤其常見。改 8s 後，等鎖端能等到正常 refresh 完成；只在持鎖端真正掛掉（達鎖 TTL 10s 仍未 release）才 503，與「上游真的有問題」一致。

> 鎖釋放**必須用 Lua 比對 token 後 DEL**，禁止裸 DEL（會誤殺別人的鎖）。Lua 腳本見 ADR 006 §6.1。

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
| Session 建立（首次登入） | `SessionService.create()` 自動產生 |
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
const session = await SessionService.get()   // 內部解 cookie → 查 Redis
return <meta name="csrf-token" content={session?.csrfToken ?? ''} />
```

### 4.5 客戶端傳送 token

unsafe method（POST / PUT / PATCH / DELETE）**必須**帶 `X-CSRF-Token`。

**約定**：GET handler **必須** idempotent；任何寫入動作必須用 POST/PUT/PATCH/DELETE。違反此約定等於繞過 CSRF 防護。

### 4.6 Server 端驗證

豁免改為 **route-level opt-in**（見 §9.1 `csrfExempt: true`），不再維護全域 path Set。理由：
- 新增 OAuth callback 等豁免端點時，「忘記加進清單 / 拼錯 path」是高機率 bug
- 豁免本質是 route 屬性，與 route 定義同檔可讀性 + grep-ability 最高
- code review 時一眼看到 `csrfExempt: true` 比追到 security 模組底下的常數更直觀

```ts
// src/lib/security/verifyCsrf.ts
import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { CsrfError } from '@/lib/errors/CsrfError'
import { allowedOrigins } from '@/lib/config'
import type { StoredSession } from '@/lib/session/types'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export type VerifyCsrfOptions = {
  /** true 時跳過 token 比對（仍檢查 Origin 白名單），用於 chicken-and-egg 端點如 `/api/csrf` / `/api/dev/login` */
  exempt?: boolean
}

/**
 * Unsafe method 才驗證；safe method 直接通過。
 *
 * - `session` 可為 null（anonymous endpoint）。非 exempt 且為 unsafe method 時，
 *   無 session ⇒ `CsrfError`（否則攻擊者用 anonymous POST 偽造寫入）。
 * - Origin 檢查**無論 exempt 與否都跑**，作為第二道防線。
 */
export function verifyCsrf(
  req: Request,
  session: StoredSession | null,
  options: VerifyCsrfOptions = {},
): void {
  if (SAFE_METHODS.has(req.method)) return

  // Origin / Referer 檢查（exempt 也適用）
  const origin = req.headers.get('origin') ?? extractOriginFromReferer(req)
  if (!origin || !allowedOrigins.has(origin)) {
    throw new CsrfError('Invalid origin')
  }

  if (options.exempt) return

  // 非 exempt：必須有 session 才能有 csrfToken 可比對
  if (!session) {
    throw new CsrfError('No session for CSRF verification')
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

#### `src/lib/security/origin.ts`

```ts
import 'server-only'
import { env } from '@/lib/config'

export const allowedOrigins: ReadonlySet<string> = new Set(
  (env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),
)

/**
 * 從 Referer header 萃取 origin（協議 + 主機 + port）；失敗回 null。
 * 用於 Origin header 缺漏的舊瀏覽器 fallback。
 */
export function extractOriginFromReferer(req: Request): string | null {
  const ref = req.headers.get('referer')
  if (!ref) return null
  try { return new URL(ref).origin } catch { return null }
}
```

---

## 5. 模組結構

```
src/
├── instrumentation.ts              # Next.js register() → registerLifecycle()（§18）
├── app/
│   └── api/
│       ├── csrf/
│       │   ├── route.ts            # GET /api/csrf
│       │   └── route.test.ts
│       ├── health/
│       │   ├── route.ts            # GET /api/health（readiness，含 Redis ping）
│       │   ├── route.test.ts
│       │   └── live/
│       │       ├── route.ts        # GET /api/health/live（liveness，不檢查依賴）
│       │       └── route.test.ts
│       ├── dev/
│       │   └── login/
│       │       ├── route.ts        # POST /api/dev/login（§10.4，僅 dev）
│       │       └── route.test.ts
│       └── <resource>/             # 個別 endpoint 由業務 spec 定義
│           ├── route.ts
│           └── route.test.ts
├── lib/
│   ├── api/
│   │   ├── backend.ts              # backendFetch(path, opts)：接 opts.session 注入 JWT、refresh 流程
│   │   ├── backend.test.ts
│   │   ├── create-route.ts         # createRoute() 高階 wrapper
│   │   ├── create-route.test.ts
│   │   ├── responses.ts            # okResponse(data, meta?) 等
│   │   ├── parsers.ts              # parseBody / parseQuery / parsePathParam（串流 decode；§9.4）
│   │   ├── parsers.test.ts
│   │   ├── request-id.ts           # newRequestId() 格式：req_<date>_<8-char-base36>
│   │   ├── http-status.ts
│   │   └── constants.ts            # timeout、cache TTL、token length 等
│   ├── session/
│   │   ├── cookie.ts               # iron-session 封裝（支援 secret rotation）：readSessionId / writeSessionId / clearSessionCookie / newSessionId（ADR 005 v2）
│   │   ├── cookie.test.ts
│   │   ├── service.ts              # SessionService：get() 純讀 / create / update / destroy / touch 同步 slide / rotateCsrfToken / refresh
│   │   ├── service.test.ts
│   │   ├── config.ts               # iron-session sessionOptions
│   │   ├── types.ts                # StoredSession / TokenPair（ADR 006 §4.1）
│   │   └── store/
│   │       ├── types.ts            # SessionStore interface（ADR 006 §5）
│   │       ├── redis.ts            # RedisSessionStore（ioredis）
│   │       ├── in-memory.ts        # InMemorySessionStore（測試替身）
│   │       └── index.ts            # getSessionStore()：依 env 決定具體 impl（DI 入口）
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
│   ├── lifecycle.ts                # SIGTERM/SIGINT graceful shutdown（§18）
│   └── mock/
│       ├── dispatch.ts             # registerMock / resolveMock
│       └── <resource>.ts           # 個別 fixture 由業務 spec 定義
└── tests/
    ├── contracts/
    │   └── session-store.contract.ts   # SessionStore 介面契約（套用 redis + in-memory 兩個 impl）
    └── helpers/
        ├── session.ts              # withSession(req, data) → 偽造 cookie + InMemoryStore 寫入
        ├── session-cookie.ts       # withSessionCookie(req, sessionId) → 只偽造 cookie 層
        ├── csrf.ts                 # csrfHeader(token)
        └── backend-mock.ts         # 設定 MSW handler 的薄包裝
```

> 約定：`src/lib/api/`、`src/lib/session/`、`src/lib/security/`、`src/lib/config.ts`、`src/lib/log.ts`、`src/lib/mock/`、`src/app/api/` 皆 **server-only**。檔頂第一行 `import 'server-only'`。

### 5.1 Next.js Request 型別約定

統一使用 Web 標準 `Request`。需 `cookies()` / `geo` 等 Next.js 特殊欄位時用 `NextRequest`，並在該 handler 註明原因。

### 5.2 `SessionService` 完整 interface

組合 `cookie.ts`（ADR 005 v2）+ `SessionStore`（ADR 006 §5），提供業務語意 API。

```ts
// src/lib/session/service.ts
import 'server-only'

export interface CreateSessionInput {
  user: { id: string; name: string }
  tokens: TokenPair
}

export type SessionUpdatePatch = Partial<
  Pick<StoredSession,
    | 'accessToken' | 'accessTokenExpiresAt'
    | 'refreshToken' | 'refreshTokenExpiresAt'
    | 'user'
  >
>

export interface SessionService {
  /**
   * 解 cookie → 查 store。**純讀**：不 slide 任何 TTL、不寫 cookie、不寫 Redis。
   * RSC 與 Route Handler 皆可安全呼叫；天然冪等。
   *
   * **不**做模組級 per-request cache。Per-request 去重由呼叫端負責——典型：
   * `createRoute` step 4 取得一次後透過 `args.session` 傳遞，handler 內呼叫
   * `backendFetch({ session })` 透傳，全程一次 Redis round-trip。
   *
   * 理由：先前版本用 `react.cache()` 包裝，但 react.cache 無 invalidate API，
   * mutation 後同一 request 內再 `get()` 會回舊值，是高機率 footgun。改用「明確傳遞」
   * 後，共用 session 由型別系統強制，而非靠約定。
   */
  get(): Promise<StoredSession | null>

  /**
   * 建立新 session（首次登入或切換帳號時呼叫）：
   * 1. 產 sessionId（cookie 層）
   * 2. 產 csrfToken（43-char base64url）
   * 3. 寫 Redis store
   * 4. 寫 cookie
   * @throws BackendUpstreamError - Redis 寫入失敗
   */
  create(input: CreateSessionInput): Promise<{ sessionId: string; csrfToken: string }>

  /**
   * 更新 session 部分欄位（典型用於 refresh 後寫入新 token pair）：
   * - 不重產 sessionId、不重產 csrfToken
   * - 不重設 createdAt
   * - 同步 slide 兩層 TTL（等同 `touch()` 副作用）
   * @throws UnauthenticatedError - 無 session 可更新
   * @throws BackendUpstreamError - Redis 寫入失敗
   */
  update(patch: SessionUpdatePatch): Promise<void>

  /**
   * 立即作廢：**先清 cookie 再清 store**。冪等（呼叫時無 session 也 no-op）。
   * 順序理由：cookie 清除是 user-facing「已登出」狀態；若先清 store 失敗，會留下
   * 仍指向有效 store 條目的 cookie，意外延長使用者 session 命。
   */
  destroy(): Promise<void>

  /**
   * **同步** slide cookie maxAge + Redis TTL。Cookie 寫入需 Route Handler / Server Action
   * context。由 `createRoute` 在 response phase 自動呼叫（§9.2 step 10）。
   * 無 session → no-op。
   * @throws Error - 在 RSC context 呼叫時，cookie 寫入會由 Next.js 拋出（呼叫端責任）
   */
  touch(): Promise<void>

  /**
   * 產新 csrfToken 寫回 store（登入狀態轉換時呼叫）。
   * @returns 新 token
   * @throws UnauthenticatedError - 無 session
   */
  rotateCsrfToken(): Promise<string>

  /**
   * 觸發 backend refresh 流程（ADR 006 §6 完整邏輯）。
   * 內部走分散式鎖 + fresh-tokens cache；多並發呼叫只打 backend 一次。
   * 成功 → 更新 session + 回傳新 StoredSession
   * @throws UnauthenticatedError - refresh 失敗（backend 401 / replay detected）
   * @throws BackendUpstreamError - backend 5xx / timeout / Redis 故障
   */
  refresh(): Promise<StoredSession>

  /**
   * 本 request 是否觸過任何 mutation（create / update / destroy / touch / rotateCsrfToken / refresh）。
   * 由 `createRoute` step 10 讀取——若為 true 則跳過 touch（mutation 路徑已 slide 過 TTL）。
   *
   * 這個旗標**僅在同一 SessionService instance 內維護**，因此 SessionService 必須 per-request
   * singleton——見下方 `getSessionService()` 的 react.cache 包裝。
   */
  wasMutated(): boolean
}
```

#### `getSessionService` factory（per-request singleton）

```ts
// src/lib/session/service.ts (續)
import { cache } from 'react'
import { readSessionId, writeSessionId, clearSessionCookie, newSessionId } from './cookie'
import { getSessionStore } from './store'
import { backendFetch } from '@/lib/api/backend'   // 僅供 refresh 內部使用
import { UnauthenticatedError } from '@/lib/errors/UnauthenticatedError'
import { BackendUpstreamError } from '@/lib/errors/BackendUpstreamError'
import {
  REFRESH_LOCK_TTL_MS, REFRESH_POLLER_TIMEOUT_MS,
  REFRESH_POLLER_INTERVAL_MS, FRESH_TOKENS_TTL_MS,
  CSRF_TOKEN_BYTES,
} from '@/lib/api/constants'
import { randomBytes } from 'node:crypto'

/**
 * Per-request singleton。同一 request 多次呼叫回傳同一 instance（react.cache 保證）。
 * 跨 request **不**共用——因 cookie / Next.js request context 各 request 不同。
 *
 * 為什麼 react.cache 在這裡 OK 但在 `get()` 不 OK：
 * - `get()` 若被 react.cache 包：mutation 後同 request 再 get 會回舊值（無 invalidate API）→ footgun
 * - factory 被 react.cache 包：cache 的是「同一個 service instance」，而 instance 內的 `wasMutated`
 *   flag 是可變的，mutation 後讀取會即時反映 → 反而是 react.cache 的正確用途
 */
export const getSessionService = cache((): SessionService => {
  const store = getSessionStore()
  let mutated = false

  return {
    async get() {
      const sid = await readSessionId()
      if (!sid) return null
      return store.get(sid)            // 純讀，不 slide
    },

    async create(input) {
      const sid = newSessionId()       // 32 bytes → 43-char base64url
      const csrfToken = newCsrfToken() // 32 bytes → 43-char base64url
      const session: StoredSession = {
        userId: input.user.id,
        accessToken: input.tokens.accessToken,
        accessTokenExpiresAt: input.tokens.accessTokenExpiresAt,
        refreshToken: input.tokens.refreshToken,
        refreshTokenExpiresAt: input.tokens.refreshTokenExpiresAt,
        user: input.user,
        csrfToken,
        createdAt: Date.now(),
      }
      // 先 store 再 cookie
      await store.set(sid, session)
      await writeSessionId(sid)
      mutated = true
      return { sessionId: sid, csrfToken }
    },

    async update(patch) {
      const sid = await readSessionId()
      if (!sid) throw new UnauthenticatedError('no session to update')
      const current = await store.get(sid)
      if (!current) throw new UnauthenticatedError('store has no entry')
      // store.set 同步 slide TTL（覆寫即重設 EXPIRE）
      await store.set(sid, { ...current, ...patch })
      mutated = true
    },

    async destroy() {
      const sid = await readSessionId()
      // 先清 cookie 再清 store
      await clearSessionCookie()
      if (sid) await store.destroy(sid).catch(() => {})
      mutated = true
    },

    async touch() {
      const sid = await readSessionId()
      if (!sid) return                  // 無 session → no-op
      const exists = await store.touch(sid)   // atomic EXPIRE (Lua)；不存在 → false
      if (!exists) {
        await clearSessionCookie()      // 殘留 cookie 指向已過期 store → 清掉
        return
      }
      await writeSessionId(sid)         // 重簽 cookie（更新 maxAge）
      mutated = true
    },

    async rotateCsrfToken() {
      const sid = await readSessionId()
      if (!sid) throw new UnauthenticatedError('no session')
      const current = await store.get(sid)
      if (!current) throw new UnauthenticatedError('store has no entry')
      const newToken = newCsrfToken()
      await store.set(sid, { ...current, csrfToken: newToken })
      mutated = true
      return newToken
    },

    async refresh() {
      const sid = await readSessionId()
      if (!sid) throw new UnauthenticatedError('no session to refresh')
      const current = await store.get(sid)
      if (!current) throw new UnauthenticatedError('store has no entry')

      // ── 1. fresh-tokens cache（命中即用） ──────────────────────
      const cached = await store.getCachedTokens(current.userId)
      if (cached) {
        const updated = { ...current, ...cached }
        await store.set(sid, updated)
        mutated = true
        return updated
      }

      // ── 2. 嘗試取鎖（ADR 006 §6 完整邏輯） ────────────────────
      const lockKey = `refresh-lock:${current.userId}`
      const lockToken = await store.acquireLock(lockKey, REFRESH_LOCK_TTL_MS)

      if (lockToken) {
        try {
          // 取得鎖後 double-check（避免上一輪 holder 剛寫完 fresh-tokens）
          const recheck = await store.getCachedTokens(current.userId)
          if (recheck) {
            const updated = { ...current, ...recheck }
            await store.set(sid, updated)
            mutated = true
            return updated
          }
          // 打 backend /auth/refresh
          const { data } = await backendFetch<TokenPair>('/auth/refresh', {
            method: 'POST',
            body: { refreshToken: current.refreshToken },
            // anonymous 呼叫：refresh 本身不該帶舊 access token
          })
          await store.setCachedTokens(current.userId, data, FRESH_TOKENS_TTL_MS)
          const updated = { ...current, ...data }
          await store.set(sid, updated)
          mutated = true
          return updated
        } finally {
          // Lua 比對 token 後 DEL（ADR 006 §6.1）
          await store.releaseLock(lockKey, lockToken).catch(() => {})
        }
      }

      // ── 3. 未取得鎖：poll fresh-tokens ───────────────────────
      const deadline = Date.now() + REFRESH_POLLER_TIMEOUT_MS
      while (Date.now() < deadline) {
        await sleep(REFRESH_POLLER_INTERVAL_MS)
        const polled = await store.getCachedTokens(current.userId)
        if (polled) {
          const updated = { ...current, ...polled }
          await store.set(sid, updated)
          mutated = true
          return updated
        }
      }
      throw new BackendUpstreamError('refresh timeout waiting for lock')
    },

    wasMutated() { return mutated },
  }
})

// —— Helpers ——————————————————————————————————————————
function newCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('base64url')
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
```

> **替身注入**：測試時 `vi.mock('@/lib/session/store', ...)` 整模組替換 `getSessionStore()` 回傳 `InMemorySessionStore`，`getSessionService` 自然走替身。**不需** `__setSessionServiceForTest`。

#### `SessionStore` interface（本 spec 內權威定義）

```ts
// src/lib/session/store/types.ts
import 'server-only'
import type { StoredSession, TokenPair } from '../types'

export interface SessionStore {
  /** 純讀，不 slide TTL。不存在 → null。 */
  get(sessionId: string): Promise<StoredSession | null>

  /** 覆寫 + 重設 TTL（= `SESSION_TTL_SECONDS`）。新舊都用。 */
  set(sessionId: string, session: StoredSession): Promise<void>

  /** Atomic EXPIRE（Lua）— 不存在回 false（呼叫端可決定清 cookie）。 */
  touch(sessionId: string): Promise<boolean>

  /** 刪除 entry。不存在也視為成功（冪等）。 */
  destroy(sessionId: string): Promise<void>

  /** 分散式鎖 SET NX EX；成功回 random token 字串、失敗回 null（ADR 006 §6.1）。 */
  acquireLock(key: string, ttlMs: number): Promise<string | null>

  /** Lua 比對 token 後 DEL（嚴禁裸 DEL）；錯 token 視為成功（no-op）。 */
  releaseLock(key: string, token: string): Promise<void>

  /** fresh-tokens cache（refresh 並發去重；ADR 006 §6）。 */
  getCachedTokens(userId: string): Promise<TokenPair | null>
  setCachedTokens(userId: string, tokens: TokenPair, ttlMs: number): Promise<void>

  /** Health check ping；連線健康 → true。 */
  ping(): Promise<boolean>

  /** Graceful shutdown（§18.2）— Redis 走 `quit()` + timeout fallback `disconnect()`；InMemory 為 no-op。 */
  close(): Promise<void>
}
```

> 本 interface 為**權威定義**。若 ADR 006 §5 的 interface 與此不一致，以本 spec 為準（ADR 006 同步更新）。

#### `getSessionStore` DI pattern

```ts
// src/lib/session/store/index.ts
import 'server-only'
import type { SessionStore } from './types'
import { RedisSessionStore } from './redis'

let instance: SessionStore | undefined

/** Production / dev 預設用 Redis。Testing 走 `vi.mock` 整模組替換，不需 setter。 */
export function getSessionStore(): SessionStore {
  if (!instance) instance = new RedisSessionStore()
  return instance
}
```

測試用法（廣域替換）：

```ts
// vitest.setup.ts
import { vi } from 'vitest'
import { InMemorySessionStore } from '@/lib/session/store/in-memory'

vi.mock('@/lib/session/store', () => {
  const mockStore = new InMemorySessionStore()
  return { getSessionStore: () => mockStore }
})
```

或單測 in-place mock：

```ts
const inMem = new InMemorySessionStore()
vi.mocked(getSessionStore).mockReturnValue(inMem)
```

> 不再使用 `__`-prefix setter 模式：`vi.mock` 已提供乾淨的型別安全替換途徑，避免「test-only export 混入生產 module」的攻擊面。

#### 實作不變式

- **`get()` 不被 react.cache 包**；factory 才被 react.cache 包 — 上方註解已說明 why
- **`create` / `destroy` 跨層順序**寫死在偽碼，不靠約定
- **`wasMutated` 是 instance state**，不是 module state — 跨 request 不汙染（react.cache 每 request 重建 instance）
- **`touch` 用 `store.touch()` 而非 `store.set()`**：前者 atomic Lua EXPIRE，後者要先 get 再 set 三 round-trip
- **`refresh` 禁止被 `create` / `update` 內部呼叫**（避免遞迴）；只從 `backendFetch` 的過期判斷或 `AUTH_TOKEN_EXPIRED` 401 路徑進入
- **`refresh` 內部 `backendFetch('/auth/refresh', ...)` 不傳 session**（refresh 本身不該帶舊 access token；用 body 裡的 refreshToken 認證）

#### Per-request session 流向

```
Browser ──▶ createRoute
              │ step 4: SessionService.get()  ──▶ Redis (1 call)
              │
              ├──▶ args.session ──▶ handler
              │                       │
              │                       └──▶ backendFetch({ session, ... })
              │                                 │ 用傳入 session 取 accessToken；不再 get()
              │                                 ▼
              │                              backend
              │
              └──▶ step 10: touch() ──▶ Redis EXPIRE + cookie write (1 call)
```

預期：**每個 request 最多 2 次 Redis 操作**（get + touch），即使 handler 內呼叫多次 `backendFetch`。

### 5.3 Cookie 層（`src/lib/session/cookie.ts` + `config.ts`）

```ts
// src/lib/session/config.ts
import type { SessionOptions } from 'iron-session'
import { env } from '@/lib/config'

/**
 * iron-session 8+ 支援 password rotation：給 object 形式（key 為數字 ID，值為 secret）。
 * 解封時嘗試所有 secret，**封裝時用最高 ID 的 secret**。
 * 輪換流程：
 *   1. 加 SESSION_SECRET_PREVIOUS = 舊 secret，SESSION_SECRET = 新 secret，部署
 *   2. 等 SESSION_TTL_SECONDS 過完（所有舊 cookie 自然過期或被新 secret 重簽）
 *   3. 移除 SESSION_SECRET_PREVIOUS
 */
export const sessionOptions: SessionOptions = {
  password: env.SESSION_SECRET_PREVIOUS
    ? { 2: env.SESSION_SECRET!, 1: env.SESSION_SECRET_PREVIOUS }
    : env.SESSION_SECRET!,
  cookieName: env.SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: env.SESSION_TTL_SECONDS,
    path: '/',
  },
  ttl: env.SESSION_TTL_SECONDS,
}
```

```ts
// src/lib/session/cookie.ts
import 'server-only'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { sessionOptions } from './config'
import { SESSION_ID_BYTES } from '@/lib/api/constants'

const CookiePayload = z.object({ sessionId: z.string().min(40).max(50) })
type CookiePayload = z.infer<typeof CookiePayload>

async function getCookieSession() {
  // Next.js 16: cookies() async；iron-session 解 / 寫都透過此 store
  return getIronSession<CookiePayload>(await cookies(), sessionOptions)
}

export async function readSessionId(): Promise<string | null> {
  const s = await getCookieSession()
  const parsed = CookiePayload.safeParse(s)
  return parsed.success ? parsed.data.sessionId : null
}

export async function writeSessionId(sessionId: string): Promise<void> {
  const s = await getCookieSession()
  s.sessionId = sessionId
  await s.save()                    // 重簽 cookie（maxAge 由 sessionOptions 提供）
}

export async function clearSessionCookie(): Promise<void> {
  const s = await getCookieSession()
  s.destroy()                       // iron-session 內建：清 cookie
}

export function newSessionId(): string {
  return randomBytes(SESSION_ID_BYTES).toString('base64url')   // 43 chars
}
```

> **CookiePayload Zod parse 為什麼還要做**：iron-session 簽章已防 *tamper*，但 **secret rotation 期間**舊 secret 可能解出 schema 不同的舊版 payload（e.g. 加過欄位、改過名稱）。Zod parse 是 schema 演進的安全網，cost 趨近於零。

### 5.4 常數與 HTTP status（`src/lib/api/constants.ts` + `http-status.ts`）

```ts
// src/lib/api/constants.ts
export const MAX_BODY_BYTES = 1_000_000              // §9.4 parseBody
export const DEFAULT_BACKEND_TIMEOUT_MS = 5_000      // §8.1
export const PRE_REFRESH_MARGIN_MS = 30_000          // §3.1 / §8.4
export const REFRESH_LOCK_TTL_MS = 10_000            // §3.4 / ADR 006 §6
export const REFRESH_POLLER_TIMEOUT_MS = 8_000       // §3.4
export const REFRESH_POLLER_INTERVAL_MS = 50         // §3.4
export const FRESH_TOKENS_TTL_MS = 60_000            // §3.4
export const CSRF_TOKEN_BYTES = 32                   // §4.2 → 43-char base64url
export const SESSION_ID_BYTES = 32                   // §2.2 → 43-char base64url
```

```ts
// src/lib/api/http-status.ts
export const HTTP = {
  OK: 200,
  BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500, BAD_GATEWAY: 502, SERVICE_UNAVAILABLE: 503, GATEWAY_TIMEOUT: 504,
} as const
```

> 集中常數的價值：log / test / spec 改數字只動一處；避免「PRE_REFRESH_MARGIN 在 §3 寫 30s，但 backend.ts 寫死 25s」這類飄移。

### 5.5 基礎設施 endpoints handler 程式碼

```ts
// src/app/api/csrf/route.ts
import { createRoute, okResponse } from '@/lib/api'
import { UnauthenticatedError } from '@/lib/errors/UnauthenticatedError'

export const GET = createRoute({
  // GET 為 safe method，verifyCsrf 直接通過；不需 csrfExempt
  handler: async ({ session }) => {
    if (!session) throw new UnauthenticatedError('no session')
    return okResponse({ csrfToken: session.csrfToken })
  },
})
```

```ts
// src/app/api/health/live/route.ts
import { createRoute, okResponse } from '@/lib/api'

export const GET = createRoute({
  // 不檢查依賴；platform 用此判斷 process 還活著
  handler: async () => okResponse({ status: 'ok' }),
})
```

```ts
// src/app/api/health/route.ts
import { createRoute } from '@/lib/api'
import { env } from '@/lib/config'
import { getSessionStore } from '@/lib/session/store'

export const GET = createRoute({
  handler: async () => {
    const redisOk = await getSessionStore().ping().catch(() => false)
    const status = redisOk ? 'ok' : 'degraded'
    const body = {
      data: {
        status,
        uptime: process.uptime(),
        version: env.APP_VERSION,
        commit: env.APP_COMMIT,
        deps: { redis: redisOk ? 'ok' : 'down' },
      },
    }
    // 直接 new Response（不用 okResponse 因為 status code 要動）
    return new Response(JSON.stringify(body), {
      status: redisOk ? 200 : 503,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store, private' },
    })
  },
})
```

### 5.6 `csrfExempt` × `requireAuth` 互動

兩個欄位**正交**，所有 4 種組合都合法：

| `requireAuth` | `csrfExempt` | 典型用途 |
|---|---|---|
| `false` | `false` | 公開讀取端點（GET 列表）|
| `false` | `true` | Chicken-and-egg 寫入：`/api/dev/login`、OAuth callback |
| `true` | `false` | **多數寫入端點**（要 session + CSRF token）|
| `true` | `true` | 罕見：已有 session 但 CSRF 用其他機制（如 logout 用 state 參數）。**Code review 必須質疑** |

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
  ) {
    super(message)
    this.name = this.constructor.name
  }
}
```

#### 7.2.1 各派生 class 規範簽名（**統一 `(message, cause?)`**）

每個檔案一個 class，pattern 相同：

```ts
// src/lib/errors/BackendTimeoutError.ts
import { BffError } from './BffError'
export class BackendTimeoutError extends BffError {
  constructor(message: string, cause?: unknown) { super('BACKEND_TIMEOUT', 504, message, cause) }
}

// 其餘比照（每檔一個）：
export class BackendUpstreamError extends BffError {
  constructor(message: string, cause?: unknown) { super('BACKEND_UPSTREAM_ERROR', 502, message, cause) }
}
export class ContractViolationError extends BffError {
  constructor(message: string, cause?: unknown) { super('CONTRACT_VIOLATION', 502, message, cause) }
}
export class ValidationError extends BffError {
  constructor(message: string, cause?: unknown) { super('VALIDATION_ERROR', 400, message, cause) }
}
export class UnauthenticatedError extends BffError {
  constructor(message: string, cause?: unknown) { super('UNAUTHENTICATED', 401, message, cause) }
}
export class CsrfError extends BffError {
  constructor(message: string, cause?: unknown) { super('CSRF_INVALID', 403, message, cause) }
}
export class NotFoundError extends BffError {
  constructor(message: string, cause?: unknown) { super('NOT_FOUND', 404, message, cause) }
}
export class PayloadTooLargeError extends BffError {
  constructor(message: string, cause?: unknown) { super('PAYLOAD_TOO_LARGE', 413, message, cause) }
}
```

> 統一 `(message, cause?)` 簽名讓呼叫端可機械化地寫 `throw new XError('...', err)`，避免不同 class 不同參數位置造成 bug。

### 7.3 統一映射

```ts
// src/lib/errors/toErrorResponse.ts
const NO_STORE_HEADERS: HeadersInit = {
  'content-type': 'application/json',
  'cache-control': 'no-store, private',
}

export function toErrorResponse(err: unknown, requestId: string): Response {
  if (err instanceof BffError) {
    return new Response(
      JSON.stringify({ error: { code: err.code, message: err.message, requestId } }),
      { status: err.httpStatus, headers: NO_STORE_HEADERS },
    )
  }
  return new Response(
    JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } }),
    { status: 500, headers: NO_STORE_HEADERS },
  )
}
```

> 用 `new Response(JSON.stringify(...))` 而非 `Response.json(...)`：前者讓 `Cache-Control` 在建構時就綁定，避免依賴 runtime 對 `Response.headers.set` 的支援。

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
| 認證標頭 | 取 `options.session.accessToken` 注入 `Authorization: Bearer <token>`；`options.session` 由呼叫端（典型為 createRoute）傳入，**backendFetch 不再呼叫 `SessionService.get()`** |
| 公開 endpoint | 不傳 `session`（或傳 `null`）即跳過認證注入；不需要 `anonymous` 旗標 |
| Access token pre-emptive refresh | `session.accessTokenExpiresAt < now + 30s` → 呼叫 `SessionService.refresh()` |
| Backend 401 `AUTH_TOKEN_EXPIRED` | `SessionService.refresh()` 後重打一次原請求；refresh 失敗則 401 UNAUTHENTICATED |
| Backend 401 `UNAUTHORIZED` | **不** refresh，`SessionService.destroy()` + 401 |
| 並發 refresh | **Redis 分散式鎖 + fresh-tokens cache**（跨 Cloud Run instance；§3.4 與 ADR 006 §6） |
| Request ID | 沿用呼叫端的 requestId（由 createRoute 產生；§9.2 step 1）；若無則 fallback 自產 |
| 連線失敗 / DNS / JSON parse 失敗 | `BACKEND_UPSTREAM_ERROR (502)` |
| Redis 不可用 | `BACKEND_UPSTREAM_ERROR (502)`；**不**降級為 anonymous（fail-closed，ADR 006 §7） |
| Timeout | `BACKEND_TIMEOUT (504)` |
| 回應解析 | `await res.json()`；不做 Zod parse（呼叫端決定 schema） |

### 8.2 簽名

```ts
export async function backendFetch<T = unknown>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    query?: Record<string, string | number | undefined>
    timeoutMs?: number
    headers?: Record<string, string>
    /**
     * 由呼叫端注入的 session（典型來源：createRoute args.session）。
     * - `undefined` / `null` → 視為公開呼叫：不注入 Authorization、不對 401 reactive refresh
     * - 有值 → 注入 Bearer + 走 pre-emptive / reactive refresh 流程
     *
     * 這個設計取代了先前的 `anonymous: true` 旗標——「沒 session 就是 anonymous」更直觀。
     */
    session?: StoredSession | null
    /**
     * 沿用呼叫端 requestId 以串連 BFF + backend 日誌；省略則自產。
     */
    requestId?: string
  },
): Promise<{ data: T; requestId: string }>
```

> 簽名移除了 `req: Request` 參數：backendFetch 內部本來就沒用到 `req` 的欄位（除了潛在的 `getSessionService().get()`，現已移除）。少傳一個參數，呼叫端更乾淨。

### 8.3 Mock 模式

`USE_MOCK=1` 時不打網路，改用 §10 的 mock dispatch。CSRF 仍由 `createRoute` 照常檢查（保持安全模式一致）。

### 8.4 完整流程（pseudocode）

```ts
// src/lib/api/backend.ts
import 'server-only'

const PRE_REFRESH_MARGIN_MS = 30_000   // §3.1 safety margin

export async function backendFetch<T>(
  path: string,
  options: BackendFetchOptions = {},
): Promise<{ data: T; requestId: string }> {
  const requestId = options.requestId ?? newRequestId()
  const start = Date.now()
  log.info({ requestId, path, method: options.method ?? 'GET' }, 'bff.upstream.start')

  try {
    // ── 1. USE_MOCK 短路 ────────────────────────────────────────
    if (env.USE_MOCK === '1') {
      const handler = resolveMock(path)
      if (!handler) throw new BackendUpstreamError(`No mock registered for ${path}`)
      const data = handler({ query: options.query, body: options.body }) as T
      log.info({ requestId, durationMs: Date.now() - start }, 'bff.upstream.mock.ok')
      return { data, requestId }
    }

    // ── 2. 準備 headers ──────────────────────────────────────
    const headers: Record<string, string> = {
      'x-request-id': requestId,
      'content-type': 'application/json',
      ...options.headers,
    }

    // ── 3. 注入 Authorization（session 存在才注入）──────────
    const inputSession = options.session ?? null
    let activeSession: StoredSession | null = inputSession
    if (inputSession) {
      // Pre-emptive refresh（§3.1）
      if (inputSession.accessTokenExpiresAt < Date.now() + PRE_REFRESH_MARGIN_MS) {
        activeSession = await getSessionService().refresh()   // 內部走 §3.4 分散式鎖
      }
      headers['authorization'] = `Bearer ${activeSession!.accessToken}`
    }

    // ── 4. 發 request ────────────────────────────────────────
    const url = buildUrl(env.BACKEND_API_URL!, path, options.query)
    const body = options.body != null ? JSON.stringify(options.body) : undefined
    const signal = AbortSignal.timeout(options.timeoutMs ?? 5000)

    let response: Response
    try {
      response = await fetch(url, { method: options.method ?? 'GET', headers, body, signal })
    } catch (err) {
      throw classifyNetworkError(err)   // → BackendTimeoutError / BackendUpstreamError
    }

    // ── 5. Handle backend 401（僅在有 session 時）─────────────
    let retried = false
    if (response.status === 401 && activeSession) {
      const errBody = await safeReadJson(response)
      const backendCode = errBody?.error?.code

      if (backendCode === 'AUTH_TOKEN_EXPIRED') {
        // §3.3 EXPIRED → refresh 並重打一次（只重打一次，避免無限循環）
        const refreshed = await getSessionService().refresh()
        headers['authorization'] = `Bearer ${refreshed.accessToken}`
        try {
          response = await fetch(url, { method: options.method ?? 'GET', headers, body, signal: AbortSignal.timeout(options.timeoutMs ?? 5000) })
        } catch (err) {
          throw classifyNetworkError(err)
        }
        retried = true
      } else {
        // §3.3 UNAUTHORIZED / 其他 401 code → 直接 destroy（不 refresh）
        await getSessionService().destroy().catch(() => {})
        throw new UnauthenticatedError(backendCode ?? 'UNAUTHORIZED')
      }
    }

    // ── 6. 重打後若仍 401 → 視為 refresh 失效 ────────────────
    if (retried && response.status === 401) {
      await getSessionService().destroy().catch(() => {})
      throw new UnauthenticatedError('refresh succeeded but retry still 401')
    }

    // ── 7. 其他 non-2xx 映射 ─────────────────────────────────
    if (!response.ok) {
      if (response.status === 404) throw new NotFoundError(`Backend 404 on ${path}`)
      if (response.status >= 500) throw new BackendUpstreamError(`Backend ${response.status}`)
      // 4xx 其他（含 backend 自己的 VALIDATION_ERROR）：當作 upstream 異常
      throw new BackendUpstreamError(`Unexpected backend status ${response.status}`)
    }

    // ── 8. 解析 JSON ────────────────────────────────────────
    let data: T
    try {
      data = await response.json() as T
    } catch {
      throw new BackendUpstreamError('Backend response not valid JSON')
    }

    log.info({ requestId, durationMs: Date.now() - start, status: response.status }, 'bff.upstream.ok')
    return { data, requestId }

  } catch (err) {
    log.warn({ requestId, durationMs: Date.now() - start, code: errorCodeOf(err) }, 'bff.upstream.error')
    throw err
  }
}

function errorCodeOf(err: unknown): string {
  return err instanceof BffError ? err.code : 'UNKNOWN'
}
function newRequestId(): string {
  // 格式：req_<ISO-date>_<8-char-base36>，例如 req_2026-06-13_k9x2pqab
  const date = new Date().toISOString().slice(0, 10)
  const rand = crypto.randomBytes(5).toString('base64url').slice(0, 8)
  return `req_${date}_${rand}`
}

// —— Helpers ————————————————————————————————————————

function classifyNetworkError(err: unknown): BffError {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return new BackendTimeoutError(err.message)
    // ECONNREFUSED / DNS / ECONNRESET / fetch network errors
    if ((err as any).code === 'ECONNREFUSED' || (err as any).code === 'ENOTFOUND') return new BackendUpstreamError(err.message)
  }
  return new BackendUpstreamError('Network error')
}

async function safeReadJson(res: Response): Promise<any> {
  try { return await res.clone().json() } catch { return null }
}
```

### 8.5 流程關鍵不變式

1. **同一請求最多打 backend 兩次**：原打 + 一次 refresh 後重打。第二次仍 401 即放棄
2. **`AUTH_TOKEN_EXPIRED` 是唯一觸發 refresh 的訊號**：通用 401 / 缺 Authorization / blacklist 命中都不 refresh（§3.3 安全要求）
3. **Refresh 過 1 次後不再 pre-emptive refresh**：避免極端時序下無限循環
4. **`options.session` 缺省 / null 跳過所有 session 邏輯**：不注入 Authorization、不對 401 reactive refresh
5. **Mock 模式跳過 session 邏輯**：但**不**跳過 createRoute 的 CSRF 檢查（§9.2 step 6）

### 8.6 與 SessionService 的整合（per-request 去重）

- `backendFetch` 不再呼叫 `SessionService.get()`——session 由 createRoute step 4 取得後透過 `args.session` 傳入。整個 request 對 Redis 的 session 讀取**保證恰好 1 次**，由型別系統強制（backendFetch 簽名沒有任何能拿到 store handle 的途徑）
- `SessionService.refresh()` 內部用 Redis 分散式鎖（ADR 006 §6），即使並發呼叫**只打一次 backend `/auth/refresh`**
- Refresh 後 `backendFetch` 內部變數 `activeSession` 已更新；若呼叫端需要看見更新後的 session，可用 `getSessionService().get()` 再讀一次（極少需要——典型寫入後 redirect 或回 envelope 即可）

---

## 9. Route Handler wrapper（`createRoute`）

集中 try/catch + getSession + verifyCsrf + body/query parse + logging + toErrorResponse，避免每個 handler 重複 boilerplate。

### 9.1 簽名

> **本 spec 不提供 cache 層**。所有 Response 一律帶 `Cache-Control: no-store`（見 §12）。若未來需要 CDN cache 或 Next.js data cache，由後續 spec 補；屆時 createRoute 才會增加 `cache` 欄位。

```ts
// src/lib/api/create-route.ts
import type { ZodType } from 'zod'

type RouteHandlerArgs<TBody, TQuery, TParams, TRequireAuth extends boolean> = {
  req: Request
  requestId: string
  body: TBody
  query: TQuery
  params: TParams
  session: TRequireAuth extends true ? StoredSession : StoredSession | null
}

type RouteOptions<TBody, TQuery, TParams, TAuth extends boolean> = {
  requireAuth?: TAuth
  bodySchema?: ZodType<TBody>
  querySchema?: ZodType<TQuery>
  paramsSchema?: ZodType<TParams>
  /**
   * 豁免 CSRF token 比對（仍檢查 Origin 白名單）。僅用於 chicken-and-egg 端點：
   * `/api/csrf`、`/api/dev/login`、OAuth callback（由 state 參數防 CSRF）。
   * 預設 false。
   */
  csrfExempt?: boolean
  handler: (args: RouteHandlerArgs<TBody, TQuery, TParams, TAuth>) => Promise<Response> | Response
}

export function createRoute<TBody = undefined, TQuery = undefined, TParams = undefined, TAuth extends boolean = false>(
  opts: RouteOptions<TBody, TQuery, TParams, TAuth>,
): (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
```

#### 9.1.1 使用驗證

| 寫法 | TS 結果 |
|---|---|
| `createRoute({ handler })` 內部 `args.session` | ✅ `StoredSession \| null` |
| `createRoute({ requireAuth: true, handler })` 內部 `args.session` | ✅ `StoredSession`（非 null） |
| `createRoute({ csrfExempt: true, handler })` | ✅ POST 不需 CSRF token，仍檢查 Origin |

### 9.2 wrapper 行為

按順序執行（任一失敗 → 走 `toErrorResponse`）：

1. 產 `requestId`、`log.info({ requestId, path, method }, 'bff.request.in')`
2. 動態 params parse（若有 `paramsSchema`）→ 失敗 `VALIDATION_ERROR`
3. Query parse（若有 `querySchema`）→ 失敗 `VALIDATION_ERROR`
4. 讀 session：`const session = await getSessionService().get()`。**此為整個 request 唯一一次 SessionService.get() 呼叫**，後續透過 args.session 傳遞
5. 若 `requireAuth: true` 且無 session → `UnauthenticatedError`
6. unsafe method（POST/PUT/PATCH/DELETE）→ `verifyCsrf(req, session, { exempt: opts.csrfExempt })`
7. Body parse（若有 `bodySchema`）→ 失敗 `VALIDATION_ERROR` / `PAYLOAD_TOO_LARGE`
8. 呼叫 `handler({ ..., session })` 取得 `Response`
9. **若 Response headers 沒有 `Cache-Control`**：重新建構 Response 帶上 `Cache-Control: no-store, private`（Web `Response.headers` 有 guard 不保證 mutable，安全做法是 new Response 而非 set；§12 設計決策）。`okResponse` / `toErrorResponse` 已主動設好，這裡是 fallback
10. **若 step 4 有 session 且 `!getSessionService().wasMutated()`：`await getSessionService().touch()`**（同步 slide cookie maxAge + Redis TTL；§2.3）。`wasMutated()` 涵蓋 handler 內呼叫的 `update / refresh / destroy / rotateCsrfToken`，避免雙 slide
11. `log.info({ requestId, status, durationMs }, 'bff.response.out')`
12. 全程 try/catch → `toErrorResponse(err, requestId)`

> Step 9 用「new Response 補 header」而非「response.headers.set」：Web Response 的 Headers 有 guard，某些 runtime（含 Next.js Route Handler）對 `set('cache-control', ...)` 行為不保證一致；建構新 Response 是跨 runtime 安全的做法。`okResponse` / `toErrorResponse` 在源頭就帶 `no-store` → 大多情況 step 9 是 no-op。

### 9.3 使用範例

```ts
// src/app/api/<resource>/route.ts （通用範本）
import { createRoute, okResponse } from '@/lib/api'
import { backendFetch } from '@/lib/api/backend'
import { FooResponseSchema, FooQuerySchema } from '@/lib/schemas/foo'

export const GET = createRoute({
  querySchema: FooQuerySchema,
  handler: async ({ requestId, query }) => {
    // 公開 endpoint：不傳 session
    const { data } = await backendFetch('/<resource>', { query, requestId })
    return okResponse(FooResponseSchema.parse(data))
  },
})

export const POST = createRoute({
  requireAuth: true,
  bodySchema: CreateFooBodySchema,
  handler: async ({ requestId, body, session }) => {
    // session 由 createRoute 注入；直接透傳給 backendFetch
    const { data } = await backendFetch('/<resource>', {
      method: 'POST', body, session, requestId,
    })
    return okResponse(FooSchema.parse(data))
  },
})
```

### 9.4 配套 helpers

```ts
// src/lib/api/responses.ts
const NO_STORE_HEADERS: HeadersInit = {
  'content-type': 'application/json',
  'cache-control': 'no-store, private',
}

export function okResponse<T>(data: T, meta?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(meta ? { data, meta } : { data }),
    { status: 200, headers: NO_STORE_HEADERS },
  )
}
```

> 與 `toErrorResponse`（§7.3）同樣用 `new Response(JSON.stringify(...))` 在建構時鎖住 Cache-Control，避開 Web Response Headers guard 的 runtime 不一致。

```ts
// src/lib/api/parsers.ts
import 'server-only'
import type { ZodType } from 'zod'
import { ValidationError } from '@/lib/errors/ValidationError'
import { PayloadTooLargeError } from '@/lib/errors/PayloadTooLargeError'
import { MAX_BODY_BYTES } from './constants'

/** Body 大小雙保險 + 串流 decode + JSON parse + Zod 驗證 */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  // Step 1：Content-Length 預檢（攻擊者宣稱大小）
  const len = req.headers.get('content-length')
  if (len && Number(len) > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError(`Body exceeds ${MAX_BODY_BYTES} bytes (content-length)`)
  }
  if (!req.body) {
    const result = schema.safeParse(undefined)
    if (!result.success) throw new ValidationError(formatZod(result.error))
    return result.data
  }
  // Step 2：串流 decode + 邊讀邊計數（防止 chunked transfer 繞過 Content-Length）
  // 用 TextDecoder stream 模式邊累計字串，避免「整個 byte buffer + 再 decode」的雙倍記憶體峰值
  const reader = req.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let text = ''
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        text += decoder.decode()   // flush
        break
      }
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {})
        throw new PayloadTooLargeError(`Body exceeds ${MAX_BODY_BYTES} bytes (streamed)`)
      }
      text += decoder.decode(value, { stream: true })
    }
  } catch (e) {
    if (e instanceof PayloadTooLargeError) throw e
    throw new ValidationError('Body is not valid UTF-8', e)
  }
  let raw: unknown
  try { raw = text.length ? JSON.parse(text) : undefined }
  catch (e) { throw new ValidationError('Body is not valid JSON', e) }
  const result = schema.safeParse(raw)
  if (!result.success) throw new ValidationError(formatZod(result.error))
  return result.data
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const raw = Object.fromEntries(new URL(req.url).searchParams)
  const result = schema.safeParse(raw)
  if (!result.success) throw new ValidationError(formatZod(result.error))
  return result.data
}

export function parsePathParams<T>(raw: Record<string, string>, schema: ZodType<T>): T {
  const result = schema.safeParse(raw)
  if (!result.success) throw new ValidationError(formatZod(result.error))
  return result.data
}

function formatZod(err: import('zod').ZodError): string {
  return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
}
```

`MAX_BODY_BYTES` 由 `src/lib/api/constants.ts` 匯出（預設 `1_000_000`，可由 spec 補微調）。

### 9.5 cache 安全性

本 spec 不提供 cache 層；§9.2 step 9 對所有 Response 強制 `Cache-Control: no-store, private`，沒有「per-user 被快取後回給別 user」的攻擊面。詳見 §12。

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

### 10.4 Dev mock session bootstrap

需登入的 endpoint 在 dev 期間沒有 OAuth 流程可走，本節定義「dev 啟動後 5 秒內就能測 auth 路徑」的最小方案。

#### 10.4.1 端點

```
POST /api/dev/login
  body 可選：{ user?: { id, name }, ttlHours?: number }
  回應：{ data: { sessionId, csrfToken, user, expiresAt } }
```

僅當以下**全部**成立時可用：

| 條件 | 防線 |
|---|---|
| `env.NODE_ENV !== 'production'` | 啟動時 route 直接 throw NotFoundError，回 404 |
| `env.ENABLE_DEV_LOGIN === '1'` | 額外白名單；prod 容器設定 `'0'` 防誤啟 |

兩道防線**並用**，避免「測試環境 NODE_ENV 設成 production」之類誤設定。

#### 10.4.2 行為

```ts
// src/app/api/dev/login/route.ts
import 'server-only'
import { env } from '@/lib/config'
import { getSessionService } from '@/lib/session/service'
import { NotFoundError } from '@/lib/errors/NotFoundError'
import { okResponse, createRoute } from '@/lib/api'

const DEV_USER = { id: 'dev-user-1', name: 'Dev User' }

export const POST = createRoute({
  csrfExempt: true,                    // chicken-and-egg：首次 login 前 client 沒 csrfToken
  handler: async () => {
    if (env.NODE_ENV === 'production' || env.ENABLE_DEV_LOGIN !== '1') {
      throw new NotFoundError('dev login disabled')
    }
    const now = Date.now()
    const accessTtlMs = 3 * 60 * 60 * 1000      // 3h，對齊 ADR 004
    const refreshTtlMs = 30 * 24 * 60 * 60 * 1000 // 30d

    const result = await getSessionService().create({
      user: DEV_USER,
      tokens: {
        accessToken: 'dev-fake-access-token',
        accessTokenExpiresAt: now + accessTtlMs,
        refreshToken: 'dev-fake-refresh-token',
        refreshTokenExpiresAt: now + refreshTtlMs,
      },
    })
    return okResponse({ ...result, user: DEV_USER, expiresAt: now + accessTtlMs })
  },
})
```

#### 10.4.3 與 USE_MOCK 的搭配

| 組合 | 結果 | 用途 |
|---|---|---|
| `USE_MOCK=1` + dev login | 完全本機跑；backend 不必啟動，fake token 不會被驗證 | **dev 預設模式** |
| `USE_MOCK=0` + dev login | session 已建但 fake token 打真 backend 會 401 | 不建議；應走真實 OAuth flow |
| `USE_MOCK=0` + 真實登入 flow | 正式流程；本 spec 範圍外（auth-login.md）| 整合測試 / production |

#### 10.4.4 CSRF 與 Origin

`/api/dev/login` 為 POST，理論上需 CSRF；但：
- 第一次呼叫時 client 還沒 session、沒 csrfToken（chicken-and-egg）
- Route 定義加 `csrfExempt: true`（§9.1）即可（與 `/api/csrf` 同處理）
- Origin 檢查**仍照常**（屬白名單，dev 必含 `http://localhost:3000`）

#### 10.4.5 環境變數

加入 §13 變數清單：

| 變數 | 範圍 | 必填 | 預設 | 用途 |
|---|---|---|---|---|
| `ENABLE_DEV_LOGIN` | server | — | `'0'` | `'1'` 啟用 `/api/dev/login`；production 自動鎖死 |

`src/lib/config.ts` superRefine 加：

```ts
if (env.NODE_ENV === 'production' && env.ENABLE_DEV_LOGIN === '1') {
  ctx.addIssue({ code: 'custom', path: ['ENABLE_DEV_LOGIN'], message: 'must not be enabled in production' })
}
```

#### 10.4.6 測試

- `NODE_ENV=production` + `ENABLE_DEV_LOGIN=1` → env 驗證失敗（啟動拒絕）
- `NODE_ENV=production` + `ENABLE_DEV_LOGIN=0` → 路由回 404
- `NODE_ENV=development` + `ENABLE_DEV_LOGIN=1` → 200，session 建立成功
- 後續對需 auth 的 endpoint 請求帶 cookie → 通過 auth 檢查

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

## 12. 快取策略：**不提供**

### 12.1 設計決策

本 spec 範圍內**不提供任何 cache 層**：

- Response 一律 `Cache-Control: no-store, private`（§9.2 step 9 強制）
- `backendFetch` 不暴露 Next.js fetch data cache 參數（無 `next` 欄位）
- 沒有 `revalidateTag` 流程

### 12.2 為什麼不做

| 理由 | 說明 |
|---|---|
| 多 instance 命中率低 | 預期 Cloud Run 多 instance 部署，per-instance 進程記憶體 cache 命中率隨 scale-out 線性下降；要解需引入 Redis cache handler，成本不划算 |
| `revalidateTag` 跨 instance 不可靠 | 同上，沒 Redis cache handler 時 tag 失效只清本機 cache，其他 instance 仍回舊資料 |
| CDN 才是正確位置 | 真要快取，正確位置是 BFF 前的 CDN（控制台 / Edge Config）或 backend 內部對 DB 的 query cache，不在 Next.js 進程裡 |
| 多一層 = 多一個 stale 故障點 | Browser → CDN → Next.js Data Cache → backend → DB；少一層少一個 debug 路徑 |
| Per-user / 搜尋本來就 no-store | 能 cache 的只剩公開列表/詳細頁，這些 CDN 已涵蓋 |

### 12.3 未來如需要

要加 cache 層時請開新 spec 處理：
- 評估部署是否仍多 instance；若是，先決定 Redis cache handler
- 在 `createRoute` 加 `cache` 欄位（型別層強制 `requireAuth × cache` 互斥）
- 在 `backendFetch` 加 `next?: { revalidate?, tags? }` 透傳到底層 fetch
- 同步更新 §9.2 step 9（不再無條件 no-store）與 §9.5 安全性規則

> 設計決策出處：本次 spec review 對話。理由詳見專案根 `docs/decisions/`（如未來寫成 ADR）。

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
  /** 上一代 secret，用於 rotation 期間 verify-only。iron-session 餵 [current, previous]，
   *  既能讀舊 cookie 又會用新 secret 重簽。輪換完拿掉即可。 */
  SESSION_SECRET_PREVIOUS: z.string().min(32).optional(),
  SESSION_COOKIE_NAME: z.string().default('jko_session'),
  /** 預設與 refresh token 壽命對齊（ADR 004：30d）。先前預設 7d 會導致「refresh 還有效但
   *  session 過期，使用者體感被莫名踢出」。對齊後使用者只在「30 天沒互動」才需重新登入。 */
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  ALLOWED_ORIGINS: z.string().optional(),

  // —— Redis（BFF session store，ADR 006）——
  REDIS_URL: z.string().url().optional(),
  REDIS_KEY_PREFIX: z.string().default('jko-bff'),
  REDIS_TLS_ENABLED: z.enum(['0', '1']).default('0'),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(1000),

  APP_VERSION: z.string().default('0.0.0'),       // 給 /api/health 用
  APP_COMMIT: z.string().optional(),              // 給 /api/health 用
  ENABLE_DEV_LOGIN: z.enum(['0', '1']).default('0'),  // 給 /api/dev/login 用，§10.4
  NEXT_PUBLIC_APP_NAME: z.string().default('JKODonation'),
}).superRefine((env, ctx) => {
  // USE_MOCK=0 時：BACKEND_API_URL、SESSION_SECRET、REDIS_URL 必填
  if (env.USE_MOCK === '0') {
    if (!env.BACKEND_API_URL) ctx.addIssue({ code: 'custom', path: ['BACKEND_API_URL'], message: 'required when USE_MOCK=0' })
    if (!env.SESSION_SECRET)  ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'],  message: 'required when USE_MOCK=0' })
    if (!env.REDIS_URL)       ctx.addIssue({ code: 'custom', path: ['REDIS_URL'],       message: 'required when USE_MOCK=0' })
  }
  // production 不允許 ALLOWED_ORIGINS 為空或僅含 localhost
  if (env.NODE_ENV === 'production') {
    const list = (env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (list.length === 0 || list.every(o => o.startsWith('http://localhost'))) {
      ctx.addIssue({ code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'production requires non-localhost origins' })
    }
  }
  // production 不允許 dev login（§10.4 第二道防線）
  if (env.NODE_ENV === 'production' && env.ENABLE_DEV_LOGIN === '1') {
    ctx.addIssue({ code: 'custom', path: ['ENABLE_DEV_LOGIN'], message: 'must not be enabled in production' })
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
| `SESSION_SECRET` | server | `USE_MOCK=0` 時必填 | — | iron-session cookie 加密金鑰（≥ 32 字元） |
| `SESSION_SECRET_PREVIOUS` | server | — | — | Rotation 期間 verify-only 的舊 secret；輪換完拿掉 |
| `SESSION_COOKIE_NAME` | server | — | `jko_session` | session cookie 名稱 |
| `SESSION_TTL_SECONDS` | server | — | `2592000`（30d，與 refresh token 對齊）| session 存活秒數（cookie + Redis 同步） |
| `ALLOWED_ORIGINS` | server | production 必且非僅 localhost | `http://localhost:3000` | CSRF Origin 白名單 |
| `REDIS_URL` | server | `USE_MOCK=0` 時必填 | — | BFF Redis 連線；`redis://` / `rediss://` |
| `REDIS_KEY_PREFIX` | server | — | `jko-bff` | Key 命名空間（多環境共用一 Redis 時隔離） |
| `REDIS_TLS_ENABLED` | server | — | `'0'` | 顯式覆寫；通常從 URL scheme 推斷 |
| `REDIS_CONNECT_TIMEOUT_MS` | server | — | `2000` | 連線 timeout |
| `REDIS_COMMAND_TIMEOUT_MS` | server | — | `1000` | 單一 command timeout |
| `APP_VERSION` | server | — | `0.0.0` | `/api/health` 回傳用 |
| `APP_COMMIT` | server | — | — | `/api/health` 回傳用 |
| `ENABLE_DEV_LOGIN` | server | — | `'0'` | `'1'` 啟用 `/api/dev/login`；production 啟動拒絕 |
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
| `sessionId`（cookie 解出後）| 只記前 4 字 + `...`（log 串連用，不洩漏完整 ID） |
| session cookie 加密字串 | 完全不 log |
| Redis key（含 sessionId / userId） | sessionId 部分套上述遮罩 |
| OAuth `state` | 只記長度 |
| 使用者 email、姓名（若未來出現） | 雜湊或 redacted |
| Internal error stack trace | 完整記入 server log；**不**回傳到 client envelope |
| Upstream error message | 摘要記入 server log；不洩漏 backend 內部訊息給 client |

### 14.3 MVP 實作（具體 API）

```ts
// src/lib/log.ts
import 'server-only'

type LogObj = Record<string, unknown>
type Level = 'info' | 'warn' | 'error'

function emit(level: Level, obj: LogObj, event: string): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...obj })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info:  (obj: LogObj, event: string) => emit('info',  obj, event),
  warn:  (obj: LogObj, event: string) => emit('warn',  obj, event),
  error: (obj: LogObj, event: string) => emit('error', obj, event),
}

// —— Masking helpers ——
export function maskBearer(authHeader: string | null | undefined): string {
  if (!authHeader) return ''
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader)
  return m ? `Bearer ${m[1].slice(0, 8)}...` : '<malformed>'
}
export function maskToken(token: string | null | undefined): string {
  return token ? `${token.slice(0, 8)}...` : ''
}
export function maskSessionId(id: string | null | undefined): string {
  return id ? `${id.slice(0, 4)}...` : ''
}
export function maskCsrfToken(token: string | null | undefined): { present: boolean; length: number } {
  return { present: Boolean(token), length: token?.length ?? 0 }
}
```

呼叫方式（spec 全篇統一）：

```ts
log.info({ requestId, path, method }, 'bff.request.in')
log.warn({ requestId, code: errorCodeOf(err) }, 'bff.upstream.error')
log.error({ requestId, err: err instanceof Error ? err.message : String(err) }, 'bff.internal.error')
```

> 接 backend 後可在不改呼叫端的前提下，把 `emit` 內部換成 `pino`。

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
- **Redis 不可用 → `BACKEND_UPSTREAM_ERROR` (502)**（fail-closed，不降級為 anonymous）

### 15.3 `session` 測試

#### 15.3.1 Cookie 層（`cookie.ts`，ADR 005 v2）
- `writeSessionId` → `readSessionId` round-trip
- 損壞 / 簽章錯的 cookie → `readSessionId` 回 `null`
- `clearSessionCookie` 清除 cookie
- `newSessionId` 產 43-char base64url

#### 15.3.2 SessionStore 契約測試（`tests/contracts/session-store.contract.ts`，套用所有 impl）

ADR 006 §10.1 規範的契約。同一組案例同時跑 `RedisSessionStore`（對 docker-compose Redis）與 `InMemorySessionStore`：

- `set` → `get` round-trip
- `get` 命中後 sliding TTL（TTL 重設）
- `destroy` 後 `get` 回 null
- `touch` 更新 TTL
- `acquireLock` 第一次成功、第二次失敗（同一 key）
- `releaseLock` 用正確 token 成功、用錯 token 失敗（Lua 原子比對）
- 鎖 TTL 到期後自動可被其他 caller 取得
- `getCachedTokens` / `setCachedTokens` round-trip
- `ping` 在連線健康時回 true

#### 15.3.3 SessionService 整合測試
- `create()`：產 sessionId + 寫 store + 寫 cookie + 自動 csrfToken
- `get()`：解 cookie → 查 store；任一環節失敗 → null
- `refresh()` 並發測試（critical，ADR 006 §10.3）：
  - 5 個並發呼叫，只有 1 個打 backend `/auth/refresh`
  - 其餘 4 個從 `getCachedTokens` 取結果
  - 5 個全成功
- `destroy()`：清 store + 清 cookie 兩者同時發生

### 15.4 `verifyCsrf` 測試

| 案例 | session | exempt | 期望 |
|---|---|---|---|
| Safe method（GET/HEAD/OPTIONS）| any | any | 通過 |
| 無 Origin 且無 Referer | any | any | `CsrfError`（Origin 檢查在 exempt 之前）|
| Origin 不在白名單 | any | any | `CsrfError`（即使 exempt 也擋）|
| `exempt: true` + Origin 正確 + 無 token | null | true | 通過 |
| `exempt: false` + Origin 正確 + null session（anonymous POST 嘗試）| null | false | `CsrfError`（防偽造寫入）|
| `exempt: false` + 無 X-CSRF-Token | 有 | false | `CsrfError` |
| Token 長度錯 | 有 | false | `CsrfError`（不可拋 native 例外）|
| Token 內容錯 | 有 | false | `CsrfError` |
| Origin + token 正確 | 有 | false | 通過 |

### 15.5 `createRoute` 測試

- 順序：params → query → auth → csrf → body → handler → Cache-Control → touch
- 任一階段失敗的錯誤碼正確
- handler 拋出非 BffError → 回 `INTERNAL_ERROR`
- `csrfExempt: true` POST：不帶 CSRF token 仍通過，但 Origin 不在白名單仍 403
- **所有 Response 強制 `Cache-Control: no-store, private`**（即使 handler 自己設了 Cache-Control 也被覆寫）
- handler 內呼叫 `update()` / `refresh()` 後，step 10 **不** 重複 touch（`touchedByHandler` 旗標生效）

### 15.6 `errors` / `config` / `/api/csrf` / `/api/health` 測試

- `toErrorResponse`：所有錯誤碼的 status + envelope 正確；未知錯誤 fallback `INTERNAL_ERROR`
- `config`：必填變數缺漏 → throw；production 的 `ALLOWED_ORIGINS` 守門；`USE_MOCK=0` 條件式必填
- `/api/csrf`：無 session → 401；有 session → 回 `csrfToken`
- `/api/health`（雙模式）：
  - Liveness（`GET /api/health/live`）：**不**檢查依賴；只回 `200 { status: 'ok' }`。供 platform 判斷「process 還活著」。Redis 暫斷時不可讓容器被殺
  - Readiness（`GET /api/health`）：含 Redis ping
    - Redis 正常 → `200 { status: 'ok', uptime, version, commit, deps: { redis: 'ok' } }`
    - Redis 不可用 → **`503 { status: 'degraded', deps: { redis: 'down' } }`**（讓 load balancer 暫時移出流量；Redis 恢復後自動歸隊）
  - 兩個端點都**不**洩漏 backend URL、secret、stack trace 等內部資訊

### 15.7 測試輔助（`tests/helpers/`）

```ts
// tests/helpers/session-cookie.ts （cookie 層；ADR 005 v2）
export async function withSessionCookie(req: Request, sessionId: string): Promise<Request>

// tests/helpers/session.ts （整合：cookie + InMemoryStore；單元測試主要用）
export async function withSession(
  req: Request,
  data: Partial<StoredSession>,
): Promise<{ req: Request; sessionId: string; store: InMemorySessionStore }>

// tests/helpers/csrf.ts
export function csrfHeader(token: string): HeadersInit { return { 'x-csrf-token': token, 'origin': 'http://localhost:3000' } }

// tests/helpers/backend-mock.ts
export function mockBackend(handler: (req: Request) => Promise<Response>): void { /* 設 MSW handler */ }
```

`SessionService` 單元測試與 Route Handler 測試**預設用 `InMemorySessionStore`**（不打網路）。`RedisSessionStore` 只在契約測試（§15.3.2）與 CI 整合測試跑。

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
| Cookie 封裝選型 | **已決定 ADR 005 v2（iron-session）** |
| Server-side session 存儲（Redis）+ provider 抽象 | **已決定 ADR 006** |
| OAuth 登入流程（Google）、`/auth/google/callback` 對接 | spec：`auth-login.md` |
| Refresh / Logout endpoint 對 backend 的明確契約 | spec：`auth-token-flow.md`（與 backend 同步） |
| 個別 resource 的 schema、endpoint、mock fixture、tag | 個別業務 spec |
| Rate limit（BFF 端） | 基礎建設後補（介面已在 ADR 006 預留） |
| Idempotency-Key for writes（轉發 backend） | 寫入操作 spec |
| Streaming / WebSocket / SSE | 無此需求 |
| Cache Components / `use cache` 在 RSC 細部使用 | UI spec |
| **任何 cache 層**（CDN s-maxage、Next.js Data Cache、revalidateTag）| 評估後**刻意不做**（§12.2）；要做時開新 spec 並加 ADR 紀錄決策反轉 |

---

## 18. Graceful shutdown

Cloud Run / Docker 停容器時送 `SIGTERM` → 10 秒寬限 → `SIGKILL`。期間 BFF 應該：
1. 停止接收新 request（Next.js 內建處理）
2. 等 in-flight request 完成
3. 主動關 Redis 連線（`ioredis` 的 `redis.quit()`）；超時 fallback `redis.disconnect()`

不做這件事的代價：使用者偶爾看到 connection reset、Redis 端 log 噴 unclean close、Cloud Run cold deploy 期間錯誤率突起。

### 18.1 實作位置

Next.js 16 沒有官方 lifecycle hook。利用 Node.js process signal：

```ts
// src/lib/lifecycle.ts
import 'server-only'
import { getSessionStore } from '@/lib/session/store'
import { log } from '@/lib/log'

let shuttingDown = false

function handleSignal(signal: NodeJS.Signals) {
  if (shuttingDown) return
  shuttingDown = true
  log.info({ signal }, 'bff.shutdown.begin')

  // 8s 內優雅關閉，留 2s 給 Cloud Run SIGKILL 餘裕
  const deadline = setTimeout(() => {
    log.warn({}, 'bff.shutdown.force')
    process.exit(0)
  }, 8000).unref()

  ;(async () => {
    try {
      const store = getSessionStore()
      if ('close' in store && typeof store.close === 'function') {
        await store.close()
      }
      log.info({}, 'bff.shutdown.clean')
    } catch (err) {
      log.error({ err: String(err) }, 'bff.shutdown.error')
    } finally {
      clearTimeout(deadline)
      process.exit(0)
    }
  })()
}

let registered = false
export function registerLifecycle(): void {
  if (registered) return
  registered = true
  process.on('SIGTERM', handleSignal)
  process.on('SIGINT', handleSignal)
}
```

呼叫時機：`src/instrumentation.ts`（Next.js 16 instrumentation hook）：

```ts
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerLifecycle } = await import('./lib/lifecycle')
    registerLifecycle()
  }
}
```

### 18.2 SessionStore 新增 `close()` method

```ts
export interface SessionStore {
  // ...既有
  /** Graceful shutdown：等待 in-flight commands、quit 連線。InMemoryStore 為 no-op。 */
  close(): Promise<void>
}
```

`RedisSessionStore.close()` 內部呼叫 `redis.quit()`；4s timeout 後 fallback `redis.disconnect()`。

### 18.3 驗證

- 單測：`store.close()` 後再呼叫 `get()` 應拋 connection-closed 類錯誤
- 整合：本機跑 `pnpm dev` → kill -TERM → 觀察 `bff.shutdown.clean` 出現 + 無 unclean Redis close 警告

---

## 17. 驗收條件

當以下都成立時，本 spec 視為**已實作**：

- [ ] `src/lib/config.ts`：env Zod 驗證、conditional required（USE_MOCK / production / Redis）、`allowedOrigins` 解析；含 `SESSION_SECRET_PREVIOUS` 可選欄位
- [ ] `src/lib/session/cookie.ts` + `config.ts`：§5.3 程式碼通過 §15.3.1 案例；secret rotation 測試（舊 cookie 可讀，新 write 用新 secret 重簽）
- [ ] `src/lib/session/store/redis.ts` 與 `in-memory.ts`：§15.3.2 SessionStore 契約測試**兩個 impl 同套案例都通過**（§5.2 interface + ADR 006 §10.1）；含 `close()` method
- [ ] `src/lib/session/service.ts`：§5.2 全部偽碼實裝；§15.3.3 整合測試通過，**含並發 refresh 5-request 測試只打 backend 一次**（critical，ADR 006 §10.3）；`get()` 為純讀無副作用；`wasMutated()` 旗標跨 mutation 路徑都生效
- [ ] `src/lib/security/verifyCsrf.ts` + `origin.ts`（含 `extractOriginFromReferer`）：§15.4 所有案例通過（含 `session=null + exempt=false` → CsrfError 的關鍵案例）
- [ ] `src/lib/api/backend.ts`：§15.2 所有案例通過；簽名為 `(path, options)`、不再呼叫 `SessionService.get()`、`options.session` 透傳；含 Redis 不可用 → 502 fail-closed
- [ ] `src/lib/api/create-route.ts`：§15.5 所有案例通過；`csrfExempt` opt 生效；所有 Response 強制 `Cache-Control: no-store, private`；`touchedByHandler` 旗標避免雙寫
- [ ] `src/lib/api/{responses,parsers,request-id,http-status,constants}.ts` 全數存在 + 測試；`okResponse` 主動帶 `Cache-Control: no-store, private`（§9.4）；`constants.ts` 與 `http-status.ts` 內容對齊 §5.4
- [ ] `src/lib/errors/*`（含 `CsrfError`、`PayloadTooLargeError`）+ `toErrorResponse` 通過所有錯誤碼測試；`toErrorResponse` 回應主動帶 `Cache-Control: no-store, private`（§7.3）
- [ ] `src/lib/schemas/envelope.ts`、`pagination.ts` 通過 happy + edge case
- [ ] `src/lib/mock/dispatch.ts`：register / resolve / 未註冊三類測試
- [ ] `src/lib/log.ts`：JSON 格式 + 敏感欄位遮罩（含 `Authorization` 前 8 字元、`X-CSRF-Token` 只記長度、`sessionId` 前 4 字）測試
- [ ] `src/lib/lifecycle.ts` + `src/instrumentation.ts`：§18 graceful shutdown 驗證項通過
- [ ] `src/app/api/csrf/route.ts`、`src/app/api/health/route.ts`、`src/app/api/health/live/route.ts` 依 §5.5 程式碼實裝，通過 §15.6 案例（readiness 含 Redis ping，Redis down → 503；liveness 不檢查依賴）
- [ ] `src/app/api/dev/login/route.ts` 通過 §10.4.6 案例（production 啟動拒絕 / 404 / dev 200）；含 `csrfExempt: true`
- [ ] `frontend/docker-compose.yml` 提供本地 Redis（ADR 006 §9）
- [ ] `.env.example` 同步包含本 spec §13.2 所有變數（含 `REDIS_*`、`SESSION_SECRET_PREVIOUS`）
- [ ] **無業務字眼自檢**：`grep -rE "charity|donation|jko[^_-]" src/lib/{api,session,security,errors,config,mock,log,schemas/{envelope,pagination}}` 應無命中（`jko-` / `jko_` 等基建前綴允許）
- [ ] 文件回填：本 spec §16 在實作時若有變動需 PR 同步更新

---

最後更新：2026-06-13（v4：補齊 5 個 blocker——SessionService 完整偽碼 / `getSessionService` factory（react.cache）/ `wasMutated()` 旗標 / `extractOriginFromReferer` / SessionStore interface 內聯含 `close()`；okResponse/toErrorResponse 在源頭設 no-store；新增 §5.3 cookie+config / §5.4 constants+http-status / §5.5 內建 endpoints 程式碼 / §5.6 csrfExempt×requireAuth）
