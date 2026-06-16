import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiSelectChips } from './MultiSelectChips'

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
]

describe('MultiSelectChips', () => {
  it('1: 渲染所有 options 為 button', () => {
    render(
      <MultiSelectChips options={OPTIONS} value={[]} onChange={() => {}} />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('2: 選中 chip → aria-pressed=true', () => {
    render(
      <MultiSelectChips
        options={OPTIONS}
        value={['a']}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('3a: 點未選 chip → onChange 加', async () => {
    const onChange = vi.fn()
    render(
      <MultiSelectChips
        options={OPTIONS}
        value={['a']}
        onChange={onChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Beta' }))
    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
  })

  it('3b: 點已選 chip → onChange 移除', async () => {
    const onChange = vi.fn()
    render(
      <MultiSelectChips
        options={OPTIONS}
        value={['a', 'b']}
        onChange={onChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Alpha' }))
    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('4: 達 max → 未選 chip disabled；已選仍可點 unselect', () => {
    render(
      <MultiSelectChips
        options={OPTIONS}
        value={['a', 'b']}
        max={2}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Gamma' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeEnabled()
  })
})
