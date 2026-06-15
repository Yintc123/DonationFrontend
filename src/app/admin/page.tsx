import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '建立帳號 | JKODonation',
}

/**
 * Spec 005 — 建立帳號頁 placeholder
 *
 * 首頁 LoginCard 的「建立帳號」按鈕指向這裡。目前只是 placeholder，
 * 後續再串實際的註冊流程。
 */
export default function AdminPage() {
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
