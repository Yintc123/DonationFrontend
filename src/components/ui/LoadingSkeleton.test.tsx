import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LoadingSkeleton } from './LoadingSkeleton'

describe('LoadingSkeleton', () => {
  it('整片標記 aria-hidden', () => {
    const { container } = render(<LoadingSkeleton variant="charity" count={3} />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).not.toBeNull()
  })

  it('variant="charity" count=3 → 3 張 row-layout skeleton（外層 flex flex-col）', () => {
    const { container } = render(<LoadingSkeleton variant="charity" count={3} />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toMatch(/flex flex-col/)
    expect(root.children.length).toBe(3)
  })

  it('variant="donation" → 外層 flex flex-col；含 aspect-[16/9] cover placeholder', () => {
    const { container } = render(<LoadingSkeleton variant="donation" count={2} />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toMatch(/flex flex-col/)
    expect(container.querySelector('[class*="aspect-[16/9]"]')).toBeTruthy()
  })

  it('variant="item" → 外層 grid grid-cols-2；含 aspect-square cover placeholder', () => {
    const { container } = render(<LoadingSkeleton variant="item" count={2} />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toMatch(/grid grid-cols-2/)
    expect(container.querySelector('[class*="aspect-square"]')).toBeTruthy()
  })

  it('count=0 → 渲染 0 張（不爆）', () => {
    const { container } = render(<LoadingSkeleton variant="charity" count={0} />)
    const root = container.firstChild as HTMLElement
    expect(root.children.length).toBe(0)
  })

  it('count=-1 → 防呆，渲染 0 張', () => {
    const { container } = render(<LoadingSkeleton variant="charity" count={-1} />)
    const root = container.firstChild as HTMLElement
    expect(root.children.length).toBe(0)
  })

  it('預設 count=6', () => {
    const { container } = render(<LoadingSkeleton variant="charity" />)
    const root = container.firstChild as HTMLElement
    expect(root.children.length).toBe(6)
  })

  it('placeholder 含 motion-reduce:animate-none class（a11y）', () => {
    const { container } = render(<LoadingSkeleton variant="item" count={1} />)
    // ItemCardSkeleton 內每個 placeholder 都帶 motion-reduce
    const motionReduce = container.querySelectorAll('[class*="motion-reduce:animate-none"]')
    expect(motionReduce.length).toBeGreaterThan(0)
  })
})
