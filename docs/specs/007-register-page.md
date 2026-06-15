# Spec 007：建立帳號頁（`/admin`）

- **狀態**：Draft（v0.1 — 初版，準生產規格）
- **建立日期**：2026-06-15
- **路徑（前端）**：
  - `src/app/admin/page.tsx`（目前 placeholder，本 spec 描述要替換的版本）
  - `src/app/admin/RegisterCard.tsx`（新 client component；mirror LoginCard 結構）
  - `src/app/admin/RegisterCard.test.tsx`
  - `src/app/api/auth/register/route.ts`（新 BFF route）
  - `src/app/api/auth/register/route.test.ts`
  - `src/lib/schemas/auth.ts`（新；register request / response 共用 Zod schema）
- **路徑（backend，**未實作**）**：
  - `POST /v1/auth/register`（backend 需新增；本 spec §6 定 contract）
- **依賴**：
  - [spec 005 §3 LoginCard](./005-homepage-auth.md#3-行為契約)（互為對稱的 UI 模板）
  - [spec 006 §3 globalQueryError](./006-error-handling.md#33-handleglobalqueryerror)（5xx 共用 toast）
  - 既有 iron-session / Redis session store / CSRF（spec 001a/c/d）
  - 既有 BffError 映射、`createRoute` helper、`getSessionService`

---

## 1. 職責

把目前 `/admin` 的 placeholder 換成可用的「建立帳號」表單。流程：

```
/ (LoginCard) ──「建立帳號」──▶ /admin ──「註冊」──▶ /dashboard（auto-login）
                                  │
                                  └──「我已有帳號」──▶ /
```

註冊成功 = backend 建 user → BFF 建 iron-session（與 [dev/login](../../src/app/api/dev/login/route.ts) 同套）→ 帶 Set-Cookie 回 client → client `router.push('/dashboard')`。**不需要使用者再回首頁登入一次**。

---

## 2. 決策

### 2.1 為何走 auto-login

| | 註冊後 auto-login（選用） | 註冊後跳 / 讓使用者再登一次 |
|---|---|---|
| 步驟 | 1 步：填表 → 進後台 | 2 步：填表 → 跳 / → 填同樣帳密 → 進後台 |
| 安全 | 同：兩種方案都建 session cookie | 同 |
| 流量 | 1 個 POST | 2 個 POST（register + login）|
| UX | 順暢 | 阻斷感重 |

主流產品（Notion / Linear / Figma 註冊流）都 auto-login，沒有不選的理由。

### 2.2 為何用「最小欄位」（帳號 + 密碼 + 密碼確認）

- 對齊 LoginCard 已有的「帳號 / 密碼」雙欄；視覺上 register 是「login + 密碼確認」延伸，使用者學習成本最低
- email / displayName 等可延後加（DB schema 留欄位即可，UI 之後補一個「個人資料」設定頁）
- 7 天 demo 不接 email verification / OAuth provider，避免 email 欄位讓使用者誤以為要收驗證信

### 2.3 為何 spec 一併寫 backend contract

backend 目前**沒有** `POST /v1/auth/register`。前端先把契約定清楚（request / response shape + error codes + sample payload），backend 實作時直接照表施工，不需要在 PR 來回 align。BFF + frontend 可以先用 `USE_MOCK` 把 register endpoint 也 fake 出來，跑通端到端 UX。

### 2.4 密碼規則 — demo 暫採寬鬆

- 長度 ≥ 8、≤ 72（bcrypt 上限）
- 不限大小寫 / 數字 / 特殊符號（避免 demo 階段使用者試帳號被擋）
- 生產環境通常會加 zxcvbn / 黑名單比對；本 spec 不涵蓋，列 §8 開放問題

### 2.5 為何不用 Server Action

Next.js 16 Server Actions 適合提交表單。本專案 LoginCard 走 `fetch('/api/dev/login')` 是因為要兼顧 client-side 載入狀態（`useTransition`）+ CSRF token 走 BFF route 比較直觀。Register 沿用同 pattern 一致性更高，也方便 unit test fetch mock。

---

## 3. UI Layout

對齊 LoginCard 風格：brand 紅 header + 卡片表單，但**少了 skip link**（register 流程結束就是進後台，不該逃離）。

```
┌─────────────────────────────────┐
│      建立帳號 (brand 紅)        │ ← h1
├─────────────────────────────────┤
│                                 │
│      ┌─────────────────┐        │
│      │ 建立帳號         │       │ ← h2
│      │ 帳號 [____]     │       │
│      │ 密碼 [____]     │       │
│      │ 確認密碼 [____] │       │
│      │ [    註冊      ]│       │ ← bg-brand text-white
│      │ [   我已有帳號  ]│       │ ← outline brand → /
│      └─────────────────┘        │
│                                 │
└─────────────────────────────────┘
```

| 元素 | className 重點 |
|---|---|
| Page wrapper | `min-h-dvh bg-surface-page flex flex-col` |
| Header | `flex items-center justify-center w-full h-11 bg-brand`；h1 white bold 17 |
| Main | `flex-1 flex flex-col items-center justify-center gap-6 px-[15px] py-10` |
| Card | `w-full max-w-[345px] mx-auto bg-surface-card rounded-2xl shadow-sm border border-line p-5 flex flex-col gap-4` |
| Field block | 同 LoginCard `<Field>` — `<label>` 包 `<span text-[13px]>` + `<input>` |
| Submit | `h-11 rounded-lg bg-brand text-white text-base font-medium disabled:opacity-50 ...` |
| Secondary | `h-11 rounded-lg border border-brand text-brand ...` |

> 重用 `<Field>` 元件：把目前 inline 在 LoginCard 內的 `<Field>` 抽到 `src/app/auth/Field.tsx` 給 LoginCard + RegisterCard 共用。

---

## 4. 行為契約

| 互動 | 行為 |
|---|---|
| 進入 `/admin` | RSC 渲染 header + `<RegisterCard />` |
| 帳號 / 密碼 / 確認任一空 | 「註冊」按鈕 `disabled` |
| 密碼 ≠ 確認密碼 | 顯示 inline `「兩次密碼輸入不一致」`、submit `disabled` |
| 密碼 < 8 字 | 顯示 inline `「密碼至少 8 個字元」`、submit `disabled`（送出時也擋） |
| 帳號 < 3 字 或 > 20 字 | 顯示 inline 提示、submit `disabled` |
| 三欄合法、按「註冊」 | `POST /api/auth/register` |
| 註冊成功（201）| `router.push('/dashboard')`；不顯示成功 toast（auto-redirect 已是回饋）|
| 帳號重複（409）| 顯示 inline `「帳號已被使用」`、不跳轉、不消除 inline message until 使用者改帳號 |
| 422 backend 驗證 | 顯示 backend `message`（已過 i18n，BFF 透傳）、不跳轉 |
| 5xx | global toast `「server 目前維修中…」`（[spec 006](./006-error-handling.md)） + inline `「註冊失敗」` |
| 註冊 in-flight | submit 改「註冊中…」、`disabled`；`useTransition` 管 isPending |
| 按「我已有帳號」 | `router.push('/')`，**不**打 API |

### 4.1 Client-side 驗證表

| 欄位 | 規則 | 錯誤訊息 |
|---|---|---|
| `username` | 3–20 字，`/^[A-Za-z0-9_]+$/` | `帳號需為 3–20 個英數字或底線` |
| `password` | 8–72 字（bcrypt 上限） | `密碼至少 8 個字元` |
| `passwordConfirm` | `=== password` | `兩次密碼輸入不一致` |

驗證寫成 Zod schema (`src/lib/schemas/auth.ts`)，client + BFF + backend 共用同一份 source。

---

## 5. BFF Route — `POST /api/auth/register`

### 5.1 入站契約

```http
POST /api/auth/register
Content-Type: application/json
X-CSRF-Token: <csrf>   # 走 csrf-check（非 dev/login 的 csrfExempt 模式）

{
  "username": "alice",
  "password": "hunter2hunter2"
}
```

`passwordConfirm` **不**送 backend——client 端確認後丟掉，只送一份密碼避免明文 over-the-wire 兩遍。

### 5.2 成功回應

```http
HTTP/1.1 201 Created
Set-Cookie: jko_session=<iron-encrypted>; HttpOnly; SameSite=Lax; Secure
Cache-Control: no-store, private

{
  "data": {
    "sessionId": "<43-char base64url>",
    "csrfToken": "<43-char base64url>",
    "user": { "id": "<uuid>", "name": "alice" },
    "expiresAt": 1781567400000
  }
}
```

BFF 流程：

```ts
// src/app/api/auth/register/route.ts
export const POST = createRoute({
  bodySchema: RegisterRequest,         // Zod: username + password
  handler: async ({ body, requestId }) => {
    // 1. backend 建 user + 回傳 tokens
    const { data: be } = await backendFetch<BackendRegisterResponse>(
      '/v1/auth/register',
      { method: 'POST', body, requestId },
    )
    // 2. BFF 建 iron-session（同 dev/login 套路）
    const result = await getSessionService().create({
      user: be.user,
      tokens: be.tokens,
    })
    return okResponse({
      ...result,
      user: be.user,
      expiresAt: be.tokens.accessTokenExpiresAt,
    }, 201)
  },
})
```

### 5.3 錯誤映射

| 觸發 | client 看到 |
|---|---|
| Zod parse fail (username 格式 / password 長度) | 400 `VALIDATION_ERROR`，message 來自 Zod |
| backend 409（username 已存在）| 409 `CONFLICT`，`{ message: '帳號已被使用' }` |
| backend 422（後端額外規則）| 422 `VALIDATION_ERROR`，message 透傳 |
| backend 5xx / timeout | 502 / 504（既有 BffError 路線） |
| 缺 CSRF token | 403 `CSRF_INVALID` |

---

## 6. Backend Contract — `POST /v1/auth/register`（未實作）

### 6.1 Request

```json
{ "username": "alice", "password": "hunter2hunter2" }
```

- `username`: 3–20 字，`/^[A-Za-z0-9_]+$/`（同 client，server 端要重做一次別信 client）
- `password`: 8–72 字（bcrypt 上限）

### 6.2 Response — 201

```json
{
  "user": { "id": "<uuid>", "name": "alice" },
  "tokens": {
    "accessToken": "<jwt>",
    "accessTokenExpiresAt": 1781567400000,
    "refreshToken": "<opaque>",
    "refreshTokenExpiresAt": 1784159400000
  }
}
```

shape 對齊現有 dev/login 流程（[spec 001c session/service](./001c-session-service.md)），BFF 不需特例。

### 6.3 Errors

| HTTP | code | 說明 |
|---|---|---|
| 409 | `CONFLICT` | `username` 已存在 |
| 422 | `VALIDATION_ERROR` | backend 額外規則（黑名單、含禁字等）|
| 500 | — | backend 內部錯 |

### 6.4 Side effects backend 要負責

- bcrypt 雜湊 password（cost 12+；不能存明文）
- 建 user row + 建 session row（atomic transaction，避免「user 建了 session 沒建」殭屍狀態）
- emit audit log（user_id + IP + UA）— 可後補

---

## 7. 測試

### 7.1 `RegisterCard.test.tsx`（client，TDD 強制）

| # | 案例 | 期望 |
|---|---|---|
| 1 | 渲染 username / password / passwordConfirm 三欄 + 兩顆按鈕 | OK |
| 2 | 任一欄空 → 註冊 disabled | OK |
| 3 | username 4 字、password 7 字 → 註冊 disabled + inline「密碼至少 8 個字元」 | OK |
| 4 | password ≠ confirm → disabled + inline「兩次密碼輸入不一致」 | OK |
| 5 | username 含中文 → disabled + inline「帳號需為 3–20 個英數字或底線」 | OK |
| 6 | 三欄合法 + 按「註冊」 → POST /api/auth/register + push('/dashboard') | mock fetch 201 |
| 7 | 409 → 顯示 inline「帳號已被使用」、不 push | mock fetch 409 |
| 8 | 5xx → 不在 RegisterCard 內 inline 處理 toast（由 global handler 接） | 確認 fetch.error 沒被吞、且 component 自己也顯示 inline「註冊失敗」 |
| 9 | 「我已有帳號」→ push('/')、不打 API | OK |
| 10 | inflight → 按鈕文字「註冊中…」、disabled | useTransition isPending = true |

### 7.2 `route.test.ts`（BFF route）

| # | 案例 | 期望 |
|---|---|---|
| 1 | happy path → backend 200 + session 建立 + 回 201 + Set-Cookie | OK |
| 2 | body schema fail | 400 VALIDATION_ERROR、不打 backend |
| 3 | backend 409 → BFF 透傳 409 CONFLICT | OK |
| 4 | backend 422 → BFF 透傳 message | OK |
| 5 | backend 500 → BFF 502 | OK |
| 6 | 缺 CSRF token → 403 CSRF_INVALID | OK |
| 7 | Cache-Control: no-store, private 在 response header | OK |

### 7.3 e2e（後續可加，本 spec 不強制）

`/admin → 填表 → submit → /dashboard` 串完整 flow，需要 backend 真的有 register endpoint 或 mock dispatcher。等 backend 實作後補。

---

## 8. 開放問題

- **email 驗證**：未來若加 email 欄位，註冊後寄驗證信、未驗證帳號不能完成 register。會引入 nodemailer / SES dependency，本 spec v0.1 不做
- **OAuth (Google / GitHub)**：可在 RegisterCard 加「使用 Google 註冊」按鈕，走 NextAuth or 自實作 OAuth state；範圍外
- **密碼強度**：8 字下限太低、不限大小寫；後續加 zxcvbn score ≥ 2 提示「密碼強度不足」（非阻擋）
- **rate limit**：同 IP / 同 username 暴力註冊；走 Redis token bucket（spec 001c 已有 session store 可重用）；後補
- **i18n**：所有 client error message hardcode 中文；接 next-intl 後抽 string table
- **username case-insensitive**：`Alice` 和 `alice` 算同一帳號？目前 spec 不指定；backend 實作時建議 `LOWER(username)` 唯一索引
- **註冊後立刻可登入 vs 等審核**：目前 auto-login = 立刻可用；公益捐款後台或許需審核流，未來再加 `pendingApproval` 狀態

---

## 9. 變更紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| 0.1 | 2026-06-15 | 初版：準生產規格——UI layout、客端 + BFF + backend contract、9 個 client test case、7 個 BFF test case；列出 7 條開放問題；不含 e2e（等 backend register endpoint 實作後補） |
