import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from './Spinner'

describe('Spinner', () => {
  it('渲染 label 文字 + role="status"', () => {
    render(<Spinner label="搜尋中…" />)
    const status = screen.getByRole('status', { name: '搜尋中…' })
    expect(status).toBeInTheDocument()
    expect(screen.getByText('搜尋中…')).toBeInTheDocument()
  })

  it('旋轉 div 套 animate-spin + motion-reduce 安全網', () => {
    const { container } = render(<Spinner label="loading" />)
    const ring = container.querySelector('[aria-hidden]')
    expect(ring).toBeTruthy()
    expect(ring?.className).toMatch(/animate-spin/)
    expect(ring?.className).toMatch(/motion-reduce:animate-none/)
  })

  it('預設 size="md"（w-10 h-10）', () => {
    const { container } = render(<Spinner label="x" />)
    const ring = container.querySelector('[aria-hidden]') as HTMLElement
    expect(ring.className).toMatch(/w-10/)
    expect(ring.className).toMatch(/h-10/)
  })

  it('size="sm" → w-6 h-6', () => {
    const { container } = render(<Spinner label="x" size="sm" />)
    const ring = container.querySelector('[aria-hidden]') as HTMLElement
    expect(ring.className).toMatch(/w-6/)
  })

  it('size="lg" → w-12 h-12', () => {
    const { container } = render(<Spinner label="x" size="lg" />)
    const ring = container.querySelector('[aria-hidden]') as HTMLElement
    expect(ring.className).toMatch(/w-12/)
  })

  it('視覺：border-line + border-t-brand（圈圈灰底、轉動段是 brand 紅）', () => {
    const { container } = render(<Spinner label="x" />)
    const ring = container.querySelector('[aria-hidden]') as HTMLElement
    expect(ring.className).toMatch(/border-line/)
    expect(ring.className).toMatch(/border-t-brand/)
  })
})
