import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopNav } from './TopNav'

const routerBackMock = vi.fn()
const routerPushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: routerBackMock, push: routerPushMock }),
  usePathname: () => '/donation',
}))

const hasNavigatedMock = vi.fn(() => false)
vi.mock('@/lib/hooks/useInAppNav', () => ({
  useHasInAppNavigated: () => hasNavigatedMock(),
}))

beforeEach(() => {
  routerBackMock.mockReset()
  routerPushMock.mockReset()
  hasNavigatedMock.mockReset()
  hasNavigatedMock.mockReturnValue(false)
})

describe('TopNav', () => {
  it('渲染 title 為 h1', () => {
    render(<TopNav title="所有捐款項目" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('所有捐款項目')
  })

  it('傳入 onBack → 按返回呼叫 onBack（不走 smart back）', async () => {
    const onBack = vi.fn()
    render(<TopNav title="所有捐款項目" onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(routerBackMock).not.toHaveBeenCalled()
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('未傳 onBack + 無 InAppNavProvider → smart back fallback → push("/") 預設', async () => {
    render(<TopNav title="所有捐款項目" />)
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(routerPushMock).toHaveBeenCalledWith('/')
    expect(routerBackMock).not.toHaveBeenCalled()
  })

  it('fallback prop 可改變預設目的地', async () => {
    render(<TopNav title="公益團體介紹" fallback="/donation" />)
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(routerPushMock).toHaveBeenCalledWith('/donation')
  })

  it('backHref 設了 → 無視 smart-back，即使「站內已動過」也 push(backHref)', async () => {
    // 關鍵：mock useHasInAppNavigated 回 true（站內已動過、smart-back 本來會 router.back）
    // backHref 必須蓋掉這條路徑、強制 push。
    hasNavigatedMock.mockReturnValue(true)
    render(<TopNav title="所有捐款項目" backHref="/" />)
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(routerPushMock).toHaveBeenCalledWith('/')
    expect(routerBackMock).not.toHaveBeenCalled()
  })

  it('onBack 優先於 backHref（onBack 是 escape hatch）', async () => {
    const onBack = vi.fn()
    render(<TopNav title="x" onBack={onBack} backHref="/" />)
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('accessory prop 渲染在右側', () => {
    render(
      <TopNav
        title="公益團體介紹"
        accessory={<button type="button">分享</button>}
      />,
    )
    expect(screen.getByRole('button', { name: '分享' })).toBeInTheDocument()
  })

  it('header semantic + 紅底 brand 樣式', () => {
    render(<TopNav title="所有捐款項目" />)
    const header = screen.getByRole('banner')
    expect(header.tagName).toBe('HEADER')
    expect(header.className).toMatch(/bg-brand/)
  })

  it('返回 icon alt 為空字串（裝飾）', () => {
    const { container } = render(<TopNav title="所有捐款項目" />)
    const img = container.querySelector('button img')
    expect(img?.getAttribute('alt')).toBe('')
  })

  // Spec 003b §3 v0.4 — TopNav sticks to viewport top during page scroll.
  it('sticky top-0 z-30 — 滾動時黏在 viewport 頂端', () => {
    render(<TopNav title="所有捐款項目" />)
    const header = screen.getByRole('banner')
    expect(header.className).toMatch(/\bsticky\b/)
    expect(header.className).toMatch(/\btop-0\b/)
    expect(header.className).toMatch(/\bz-30\b/)
  })
})
