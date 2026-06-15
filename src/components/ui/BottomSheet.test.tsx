import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet, SHEET_TRANSITION_MS } from './BottomSheet'

describe('BottomSheet', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('open=false → 不渲染 dialog', () => {
    render(
      <BottomSheet open={false} title="t" onClose={() => {}}>
        <p>body</p>
      </BottomSheet>,
    )
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('open=true → 渲染 dialog + aria-modal + aria-labelledby 對應 title', () => {
    render(
      <BottomSheet open title="捐款設定" onClose={() => {}}>
        <p>body</p>
      </BottomSheet>,
    )
    const dlg = document.body.querySelector(
      '[role="dialog"]',
    ) as HTMLElement | null
    expect(dlg).not.toBeNull()
    expect(dlg).toHaveAttribute('aria-modal', 'true')
    const labelledBy = dlg!.getAttribute('aria-labelledby')!
    expect(document.getElementById(labelledBy)).toHaveTextContent('捐款設定')
  })

  it('Portal target：dialog 是 document.body 的後代而非 caller 樹', () => {
    const Caller = () => (
      <div data-testid="caller">
        <BottomSheet open title="t" onClose={() => {}}>
          inside
        </BottomSheet>
      </div>
    )
    const { container } = render(<Caller />)
    // caller 樹內找不到 dialog
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    // body 內找得到
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('點 X 按鈕 → onClose 被叫', async () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open title="t" onClose={onClose}>
        body
      </BottomSheet>,
    )
    await userEvent.click(screen.getByRole('button', { name: '關閉' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('點 backdrop → onClose 被叫', async () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open title="t" onClose={onClose}>
        body
      </BottomSheet>,
    )
    const backdrop = document.body.querySelector(
      '[data-testid="bottom-sheet-backdrop"]',
    ) as HTMLElement
    await userEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('點 panel 內部 → onClose 不被叫（stopPropagation）', async () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open title="t" onClose={onClose}>
        <p>inside panel</p>
      </BottomSheet>,
    )
    await userEvent.click(screen.getByText('inside panel'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Esc 鍵 → onClose 被叫', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open title="t" onClose={onClose}>
        body
      </BottomSheet>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('open=true 時 body overflow=hidden；close 後還原', () => {
    const { rerender } = render(
      <BottomSheet open title="t" onClose={() => {}}>
        body
      </BottomSheet>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <BottomSheet open={false} title="t" onClose={() => {}}>
        body
      </BottomSheet>,
    )
    expect(document.body.style.overflow).toBe('')
  })

  it('open=true 時 initial focus 在 X 按鈕', () => {
    render(
      <BottomSheet open title="t" onClose={() => {}}>
        <input data-testid="form-input" />
      </BottomSheet>,
    )
    const closeBtn = screen.getByRole('button', { name: '關閉' })
    expect(document.activeElement).toBe(closeBtn)
  })

  it('open: true → false → transition 結束前仍 mount、結束後 unmount', async () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(
        <BottomSheet open title="t" onClose={() => {}}>
          body
        </BottomSheet>,
      )
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()

      rerender(
        <BottomSheet open={false} title="t" onClose={() => {}}>
          body
        </BottomSheet>,
      )
      // transition 中：仍掛在 DOM
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()

      act(() => {
        vi.advanceTimersByTime(SHEET_TRANSITION_MS + 10)
      })
      expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('Focus trap：Tab 從最後可聚焦回到第一個', () => {
    render(
      <BottomSheet open title="t" onClose={() => {}}>
        <button data-testid="first-btn">First</button>
        <button data-testid="last-btn">Last</button>
      </BottomSheet>,
    )
    const closeBtn = screen.getByRole('button', { name: '關閉' })
    const last = screen.getByTestId('last-btn')
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(closeBtn)
  })

  it('Focus trap：Shift+Tab 從第一個跳到最後', () => {
    render(
      <BottomSheet open title="t" onClose={() => {}}>
        <button data-testid="first-btn">First</button>
        <button data-testid="last-btn">Last</button>
      </BottomSheet>,
    )
    const closeBtn = screen.getByRole('button', { name: '關閉' })
    const last = screen.getByTestId('last-btn')
    closeBtn.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
