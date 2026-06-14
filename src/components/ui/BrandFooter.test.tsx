import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandFooter } from './BrandFooter'

describe('BrandFooter', () => {
  it('預設渲染品牌標語「愛心沒有底線」', () => {
    render(<BrandFooter />)
    expect(screen.getByText('愛心沒有底線')).toBeInTheDocument()
  })

  it('自訂 label 渲染正確', () => {
    render(<BrandFooter label="一起來捐款" />)
    expect(screen.getByText('一起來捐款')).toBeInTheDocument()
    expect(screen.queryByText('愛心沒有底線')).not.toBeInTheDocument()
  })

  it('渲染為 footer landmark 含 aria-label', () => {
    render(<BrandFooter />)
    const footer = screen.getByRole('contentinfo', { name: '品牌標語' })
    expect(footer.tagName).toBe('FOOTER')
  })

  it('兩條橫線標記 aria-hidden', () => {
    const { container } = render(<BrandFooter />)
    const dividers = container.querySelectorAll('[aria-hidden]')
    expect(dividers.length).toBe(2)
  })
})
