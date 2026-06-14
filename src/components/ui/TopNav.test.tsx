import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopNav } from './TopNav'

describe('TopNav', () => {
  it('渲染 title 為 h1', () => {
    render(<TopNav title="所有捐款項目" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('所有捐款項目')
  })

  it('按返回按鈕觸發 onBack', async () => {
    const onBack = vi.fn()
    render(<TopNav title="所有捐款項目" onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('未傳 onBack 時按返回不爆', async () => {
    render(<TopNav title="所有捐款項目" />)
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    // no assertion needed — just verifying no exception
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument()
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
})
