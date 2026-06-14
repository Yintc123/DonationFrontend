import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from './Spinner'

describe('Spinner', () => {
  it('預設 label「載入中…」+ role="status"', () => {
    render(<Spinner />)
    expect(
      screen.getByRole('status', { name: '載入中…' }),
    ).toBeInTheDocument()
  })

  it('自訂 label 套 aria-label', () => {
    render(<Spinner label="搜尋中" />)
    expect(screen.getByRole('status', { name: '搜尋中' })).toBeInTheDocument()
  })

  it('iOS 風 8 spoke：渲染 8 個 <rect>', () => {
    const { container } = render(<Spinner />)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBe(8)
  })

  it('每個 spoke 透明度漸層 1/8 ~ 8/8（造成 trail 效果）', () => {
    const { container } = render(<Spinner />)
    const rects = Array.from(container.querySelectorAll('rect'))
    const opacities = rects.map((r) => Number(r.getAttribute('opacity')))
    // 8 個獨立漸層值，最小 0.125、最大 1
    expect(Math.min(...opacities)).toBeCloseTo(0.125, 3)
    expect(Math.max(...opacities)).toBeCloseTo(1, 3)
    expect(new Set(opacities).size).toBe(8)
  })

  it('spinner 套 animate-spin + steps(8) + motion-reduce', () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg') as SVGElement
    expect(svg.getAttribute('class')).toMatch(/animate-spin/)
    expect(svg.getAttribute('class')).toMatch(/motion-reduce:animate-none/)
    expect(svg.getAttribute('style')).toMatch(/steps\(8\)/)
  })

  it('預設 size="md" → w-6 h-6（Figma 24×24）', () => {
    const { container } = render(<Spinner />)
    const wrapper = container.querySelector('[role="status"]') as HTMLElement
    expect(wrapper.className).toMatch(/w-6/)
    expect(wrapper.className).toMatch(/h-6/)
  })

  it('size="sm" → w-4', () => {
    const { container } = render(<Spinner size="sm" />)
    const wrapper = container.querySelector('[role="status"]') as HTMLElement
    expect(wrapper.className).toMatch(/w-4/)
  })

  it('size="lg" → w-8', () => {
    const { container } = render(<Spinner size="lg" />)
    const wrapper = container.querySelector('[role="status"]') as HTMLElement
    expect(wrapper.className).toMatch(/w-8/)
  })

  it('預設色 text-ink-A（caller 可在 wrapper 套 text-* override）', () => {
    const { container } = render(<Spinner />)
    const wrapper = container.querySelector('[role="status"]') as HTMLElement
    expect(wrapper.className).toMatch(/text-ink-A/)
  })
})
