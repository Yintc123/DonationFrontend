import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('渲染 title 為 h2', () => {
    render(<EmptyState illustration="/figma/empty-no-data.png" title="查無相關資料" />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toHaveTextContent('查無相關資料')
  })

  it('傳 subtitle 時渲染', () => {
    render(
      <EmptyState
        illustration="/figma/empty-no-data.png"
        title="查無相關資料"
        subtitle="請調整關鍵字再重新搜尋"
      />,
    )
    expect(screen.getByText('請調整關鍵字再重新搜尋')).toBeInTheDocument()
  })

  it('沒傳 subtitle 時不渲染', () => {
    const { container } = render(
      <EmptyState illustration="/figma/empty-no-data.png" title="查無相關資料" />,
    )
    expect(container.querySelector('p')).toBeNull()
  })

  it('插畫 src 對應 illustration prop', () => {
    render(<EmptyState illustration="/figma/empty-no-data.png" title="查無相關資料" />)
    const img = screen.getByRole('presentation', { hidden: true }) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/figma/empty-no-data.png')
  })

  it('插畫 alt 為空字串（裝飾）', () => {
    const { container } = render(
      <EmptyState illustration="/figma/empty-no-data.png" title="查無相關資料" />,
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('')
  })
})
