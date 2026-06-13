# 作業需求書

來源：Figma 設計稿《2026 全端面試作業 - web》
File key：`0kx2Ne2rvndhfVr3uVUwad`

---

## 1. 作業需求（原文）

### 🧰 開發限制
- 前端：React or NextJS
- 後端：NodeJS（Express 或 Fastify）
- 全程 TypeScript

### ✅ 功能需求

**前端**
1. 完成「捐款項目列表」刻板（依 Figma 設計）
2. 實現**無限滾動**載入更多卡片
3. **搜尋框關鍵字搜尋**
4. 不確定實作方式可參考「街口 App > 公益捐款項目 > 搜尋」

**後端**
1. 依畫面想像自定義 API Spec
2. 實作 API（列表、分頁查詢） — 可用 Mock Data

### ⭐ 加分項
1. 使用 TailwindCSS
2. 使用 TypeORM 或 Prisma
3. Auto Testing（unit / e2e）
4. 自由發揮
5. 建立 Database，存放設計好的 Mock Data
6. 使用 ORM 操作 SQL

### 📤 繳交方式
1. 信件附 GitHub 連結
2. **必附 demo 連結** ✅
3. 七天內繳交

> 盡情展現最擅長的部分，若因時間關係無法完善不會扣分。

### 🤖 AI 使用要求
- README 加 `## AI 使用聲明`（工具 / AI 範圍 / 我負責範圍）
- `/docs/decisions/` 至少 3 個 ADR
- `/docs/prompts/` 或 README 內 2–3 個代表性 Prompt 紀錄

---

## 2. 設計畫面盤點

設計寬度 **375px（iPhone X）** → 行動裝置優先設計。

| # | Frame 名稱 | 狀態 |
|---|---|---|
| 1 | 分類列表 - 全部團體 | 初始列表（含 Tab、搜尋、卡片清單） |
| 2 | 分類列表 - 搜尋中 | 點開搜尋框輸入中的狀態 |
| 3 | 分類列表 - 全部團體（變體） | 列表展開狀態（待確認差異） |
| 4 | 搜尋 - No Result - 公益團體 | 搜尋無結果空狀態 |

### 共同元素（自 Figma 觀察）
- 上方：iOS Status Bar + 自訂 Navigation Bar（含返回、分享）
- Tabs：`公益團體` / `捐款專案` / `義賣商品`（本作業僅實作「公益團體」）
- Filter：`全部` 下拉
- Search bar（icon button → 展開輸入框）
- Charity card：logo + 團體名稱 + 簡介
- 底部 marker：`愛心沒有底線`

---

## 3. 範圍與非範圍

**本次實作**
- 桌面 + 行動 RWD（以 375px 為設計基準，向上適配）
- 捐款項目列表（公益團體分頁）— 列表、搜尋、無限滾動、無結果空狀態

**非範圍**
- `捐款專案` / `義賣商品` 分頁僅顯示 tab（不切換內容）
- 真實金流、會員、捐款流程
- i18n、a11y 進階（基本語意 OK，不做完整 ARIA 審查）

---

最後更新：2026-06-13
