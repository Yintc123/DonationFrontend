'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Spec 005 — 首頁登入卡片（demo 用）
 *
 * 帳密欄位目前**僅做客端非空驗證**；送出時呼叫 POST /api/dev/login（不
 * 帶 payload，本機 dev 模式只要 `ENABLE_DEV_LOGIN=1` 就回 session）。
 * 成功 → /dashboard；失敗 → 顯示 inline 錯誤。
 *
 * 「建立帳號」按鈕純前端導航 → /admin（註冊頁 placeholder，未串 API）。
 */
export function LoginCard() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canSubmit = username.length > 0 && password.length > 0 && !isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/dev/login', { method: 'POST' })
        if (!res.ok) {
          setError(`登入失敗 (HTTP ${res.status.toString()})`)
          return
        }
        router.push('/dashboard')
      } catch (e) {
        setError(`登入失敗：${e instanceof Error ? e.message : '網路錯誤'}`)
      }
    })
  }

  return (
    <section
      aria-labelledby="login-card-title"
      className="w-full max-w-[345px] mx-auto bg-surface-card rounded-2xl
                 shadow-sm border border-line p-5 flex flex-col gap-4"
    >
      <h2
        id="login-card-title"
        className="text-base font-semibold text-ink-AAA leading-6"
      >
        登入
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field
          id="login-username"
          label="帳號"
          type="text"
          autoComplete="username"
          value={username}
          onChange={setUsername}
        />
        <Field
          id="login-password"
          label="密碼"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        {error && (
          <p
            role="alert"
            className="text-[13px] leading-5 text-brand"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-11 rounded-lg bg-brand text-white text-base font-medium leading-6
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand
                     hover:bg-brand/90"
        >
          {isPending ? '登入中…' : '登入後台'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="h-11 rounded-lg bg-surface-card border border-brand text-brand text-base font-medium leading-6
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand
                     hover:bg-brand/5"
        >
          建立帳號
        </button>
      </form>
    </section>
  )
}

function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
}: {
  id: string
  label: string
  type: 'text' | 'password'
  autoComplete: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[13px] leading-5 text-ink-AA">{label}</span>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 rounded-lg bg-surface-card border border-line
                   text-sm text-ink-AAA placeholder:text-ink-A
                   focus:outline-none focus:border-brand"
      />
    </label>
  )
}
