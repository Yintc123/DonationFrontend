# JKODonation — Frontend

2026 全端面試作業：捐款項目列表（公益團體）。
本目錄為 **Next.js 16（App Router）+ BFF** 前端應用。

> 設計稿：Figma《2026 全端面試作業 - web》

---

## Quick Start

```bash
pnpm install
cp .env.example .env.local      # 填入必要變數
pnpm dev                        # http://localhost:3000
```

## Scripts

| 指令 | 用途 |
|---|---|
| `pnpm dev` | 啟動開發伺服器 |
| `pnpm build` | 產出 production build |
| `pnpm start` | 跑 production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright e2e |

## Tech Stack

Next.js 16 (App Router, Turbopack default, React Compiler) · React 19.2 · TypeScript · TailwindCSS · TanStack Query · Zod · Vitest · Playwright · pnpm

## 文件

- [`docs/brief.md`](./docs/brief.md) — 作業需求、畫面盤點、範圍
- [`docs/architecture.md`](./docs/architecture.md) — BFF 架構、資料流、資料夾結構
- [`docs/specs/`](./docs/specs/) — API / UI 實作規格（持續補上）
- 專案根 `/docs/decisions/` — ADR（架構決策紀錄）

---

## AI 使用聲明

本專案在開發過程中使用 AI 工具輔助。

### 使用的 AI 工具
- Claude（Claude Code CLI，模型：Opus 4.7）

### AI 負責的範圍
> 開發完成後補上：列出由 AI 產出或 AI 輔助完成的模組/檔案。

### 我自己負責的範圍
> 開發完成後補上：列出獨立完成、或對 AI 產出做了大幅修改的部分。

### Prompt 紀錄
代表性 Prompt 對話見 [`/docs/prompts/`](../docs/prompts/)（或開發後補摘要於此）。
