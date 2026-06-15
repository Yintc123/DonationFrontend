import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '建立帳號 | JKODonation',
}

/**
 * Spec 007 v0.2 — 建立帳號頁（placeholder）
 *
 * 首頁 LoginCard 的「建立帳號」按鈕指向 `/register`。spec 007 已對齊
 * backend spec 008 v0.6（Argon2id / `/auth/register` / username 3–30 等）
 * 的 contract；UI / hook / BFF route 待後續實作，此檔暫保留 placeholder
 * 以維持導航通路。
 *
 * 為何不再用 `/admin`：spec 008 §10 / spec 007 §10「路由命名澄清」—
 * BE 有 `role=0=ADMIN` 概念與 `requireAdmin` preHandler；把面向所有
 * 使用者的「建立帳號」掛在 `/admin` 路徑會與「ADMIN role 限定區」概念
 * 衝突，故拆開：`/register` 是公開註冊入口，`/admin` 留給未來真正的
 * admin 後台。
 */
export default function RegisterPage() {
  return (
    <div className="min-h-dvh bg-surface-page flex flex-col">
      <header className="flex items-center justify-center w-full h-11 bg-brand px-[14px]">
        <h1 className="text-white text-[17px] font-bold leading-[22px]">
          建立帳號
        </h1>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-[15px] py-10">
        <p className="text-sm text-ink-AA text-center">
          建立帳號功能尚未開發。
        </p>
        <Link
          href="/"
          className="text-sm text-ink-link underline underline-offset-2"
        >
          ← 回首頁
        </Link>
      </main>
    </div>
  )
}
