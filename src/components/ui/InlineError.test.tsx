import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineError } from './InlineError'

describe('InlineError', () => {
  it('預設 message 為「連線失敗，請稍候再試」', () => {
    render(<InlineError onRetry={() => {}} />)
    expect(screen.getByText('連線失敗，請稍候再試')).toBeInTheDocument()
  })

  it('自訂 message 渲染', () => {
    render(<InlineError message="載入下一頁失敗" onRetry={() => {}} />)
    expect(screen.getByText('載入下一頁失敗')).toBeInTheDocument()
  })

  it('按重試按鈕呼叫 onRetry', async () => {
    const onRetry = vi.fn()
    render(<InlineError onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: '重試' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('button type 為 "button"（避免 form submit）', () => {
    render(<InlineError onRetry={() => {}} />)
    const btn = screen.getByRole('button', { name: '重試' })
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('容器有 role="alert"（SR 立即讀出）', () => {
    render(<InlineError onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
