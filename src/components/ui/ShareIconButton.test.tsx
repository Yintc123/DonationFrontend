// Spec 004a §4 + v0.3 — ShareIconButton driven by Web Share API
// (navigator.share) with a clipboard fallback when the API is absent or
// rejects with anything other than AbortError.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

import { ShareIconButton } from './ShareIconButton'

type NavMock = {
  share?: ReturnType<typeof vi.fn>
  clipboard?: { writeText: ReturnType<typeof vi.fn> }
}

const originalShare = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  'share',
)
const originalClipboard = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  'clipboard',
)

function installNavigator(mocks: NavMock) {
  Object.defineProperty(navigator, 'share', {
    value: mocks.share,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(navigator, 'clipboard', {
    value: mocks.clipboard,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  toastSuccessMock.mockReset()
  toastErrorMock.mockReset()
})

afterEach(() => {
  // Restore prototype descriptors so the next test gets a clean navigator.
  if (originalShare) {
    Object.defineProperty(Navigator.prototype, 'share', originalShare)
  } else {
    // @ts-expect-error — happy-dom navigator doesn't ship share by default
    delete navigator.share
  }
  if (originalClipboard) {
    Object.defineProperty(Navigator.prototype, 'clipboard', originalClipboard)
  } else {
    // @ts-expect-error — happy-dom navigator doesn't ship clipboard either
    delete navigator.clipboard
  }
})

describe('ShareIconButton', () => {
  it('aria-label 為「分享」(a11y)', () => {
    installNavigator({})
    render(<ShareIconButton />)
    expect(screen.getByRole('button', { name: '分享' })).toBeInTheDocument()
  })

  it('navigator.share 存在 → 點擊呼叫 share({ title, url })', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    installNavigator({ share })
    render(
      <ShareIconButton
        title="ACC 中華耆幼關懷協會"
        url="https://example.com/charities/abc"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '分享' }))
    expect(share).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledWith({
      title: 'ACC 中華耆幼關懷協會',
      url: 'https://example.com/charities/abc',
    })
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('傳 text 才放進 payload', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    installNavigator({ share })
    render(<ShareIconButton title="t" url="u" text="一起做公益" />)
    await userEvent.click(screen.getByRole('button', { name: '分享' }))
    expect(share).toHaveBeenCalledWith({
      title: 't',
      url: 'u',
      text: '一起做公益',
    })
  })

  it('未傳 props → 用 document.title + window.location.href 作為預設', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    installNavigator({ share })
    document.title = 'JKODonation Detail'
    render(<ShareIconButton />)
    await userEvent.click(screen.getByRole('button', { name: '分享' }))
    expect(share).toHaveBeenCalledWith({
      title: 'JKODonation Detail',
      url: window.location.href,
    })
  })

  it('使用者按系統 share sheet 取消（AbortError）→ 不 fallback、不 toast', async () => {
    const abortErr = Object.assign(new Error('user cancelled'), {
      name: 'AbortError',
    })
    const share = vi.fn().mockRejectedValue(abortErr)
    const writeText = vi.fn().mockResolvedValue(undefined)
    installNavigator({ share, clipboard: { writeText } })
    render(<ShareIconButton url="u" />)
    await userEvent.click(screen.getByRole('button', { name: '分享' }))
    expect(share).toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('share 拋非 AbortError → fallback 寫入剪貼簿 + toast.success', async () => {
    const share = vi.fn().mockRejectedValue(new Error('boom'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    installNavigator({ share, clipboard: { writeText } })
    render(<ShareIconButton url="https://example.com/x" />)
    await userEvent.click(screen.getByRole('button', { name: '分享' }))
    expect(writeText).toHaveBeenCalledWith('https://example.com/x')
    expect(toastSuccessMock).toHaveBeenCalledWith('已複製連結')
  })

  it('navigator.share 不存在 → 直接走剪貼簿 fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    installNavigator({ clipboard: { writeText } })
    render(<ShareIconButton url="https://example.com/y" />)
    await userEvent.click(screen.getByRole('button', { name: '分享' }))
    expect(writeText).toHaveBeenCalledWith('https://example.com/y')
    expect(toastSuccessMock).toHaveBeenCalledWith('已複製連結')
  })

  it('share + clipboard 都不可用 → toast.error', async () => {
    installNavigator({}) // no share, no clipboard
    render(<ShareIconButton url="u" />)
    await userEvent.click(screen.getByRole('button', { name: '分享' }))
    expect(toastErrorMock).toHaveBeenCalledWith('無法分享')
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('clipboard.writeText 失敗 → toast.error', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'))
    installNavigator({ clipboard: { writeText } })
    render(<ShareIconButton url="u" />)
    await userEvent.click(screen.getByRole('button', { name: '分享' }))
    expect(toastErrorMock).toHaveBeenCalledWith('無法分享')
  })
})
