import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryMenu } from './CategoryMenu'

describe('CategoryMenu', () => {
  beforeEach(() => {
    // 清空 body inline style，避免測試彼此污染
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('isOpen=false → 不渲染 dialog', () => {
    render(
      <CategoryMenu
        isOpen={false}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('isOpen=true → 渲染 17 個 option（全部 + 16 categories）', () => {
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBe(17)
    expect(screen.getByRole('radio', { name: '全部' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '動物保護' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '國際救援' })).toBeInTheDocument()
  })

  it('selectedCategory=null → 「全部」aria-checked=true 且帶 border-brand', () => {
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    const all = screen.getByRole('radio', { name: '全部' })
    expect(all).toHaveAttribute('aria-checked', 'true')
    expect(all.className).toMatch(/border-brand/)
    expect(all.className).toMatch(/text-brand/)
  })

  it('selectedCategory=animal_protection → 「動物保護」aria-checked=true', () => {
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory="animal_protection"
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    const target = screen.getByRole('radio', { name: '動物保護' })
    expect(target).toHaveAttribute('aria-checked', 'true')
    expect(target.className).toMatch(/border-brand/)
  })

  it('點 option → onSelect + onClose 各被呼叫一次', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    await userEvent.click(screen.getByRole('radio', { name: '動物保護' }))
    expect(onSelect).toHaveBeenCalledWith('animal_protection')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('點「全部」→ onSelect(null) + onClose', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory="animal_protection"
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    await userEvent.click(screen.getByRole('radio', { name: '全部' }))
    expect(onSelect).toHaveBeenCalledWith(null)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('點 X 關閉按鈕 → onClose；不觸 onSelect', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '關閉' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('點 backdrop → onClose', async () => {
    const onClose = vi.fn()
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={onClose}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '關閉選單' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc → onClose', () => {
    const onClose = vi.fn()
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={onClose}
      />,
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('開啟時 body overflow="hidden"；關閉後 restore', () => {
    const { rerender } = render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <CategoryMenu
        isOpen={false}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    expect(document.body.style.overflow).toBe('')
  })

  it('ARIA：role="dialog" + aria-modal="true" + radiogroup', () => {
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('動畫：open 時 sheet 套 animate-slide-up-enter、backdrop 套 animate-fade-in-bg', () => {
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    const dialog = screen.getByRole('dialog')
    const section = dialog.querySelector('section')!
    const backdrop = dialog.querySelector('button[aria-label="關閉選單"]')!
    expect(section.className).toMatch(/animate-slide-up-enter/)
    expect(backdrop.className).toMatch(/animate-fade-in-bg/)
  })

  it('動畫：close 後 sheet 切到 animate-slide-down-exit + backdrop 切到 fade-out，仍在 DOM', () => {
    const { rerender } = render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    rerender(
      <CategoryMenu
        isOpen={false}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )

    // close 後仍在 DOM（exit keyframe 跑中）
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    const section = dialog.querySelector('section')!
    const backdrop = dialog.querySelector('button[aria-label="關閉選單"]')!
    expect(section.className).toMatch(/animate-slide-down-exit/)
    expect(backdrop.className).toMatch(/animate-fade-out-bg/)
  })

  it('動畫：onAnimationEnd（slide-down-exit）→ unmount；其他 animationName 不 unmount', () => {
    const { rerender } = render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    rerender(
      <CategoryMenu
        isOpen={false}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    const section = screen.getByRole('dialog').querySelector('section')!

    // 假觸發其他 keyframe end → 不該 unmount
    fireEvent.animationEnd(section, { animationName: 'fade-out-bg' })
    expect(screen.queryByRole('dialog')).toBeInTheDocument()

    // 觸發 slide-down-exit end → 才 unmount
    fireEvent.animationEnd(section, { animationName: 'slide-down-exit' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('動畫：isOpen=true 時 onAnimationEnd（slide-up-enter）不會誤 unmount', () => {
    render(
      <CategoryMenu
        isOpen={true}
        selectedCategory={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    const section = screen.getByRole('dialog').querySelector('section')!
    fireEvent.animationEnd(section, { animationName: 'slide-up-enter' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
