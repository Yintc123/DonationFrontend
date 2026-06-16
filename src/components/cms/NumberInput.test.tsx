import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { NumberInput } from './NumberInput'

describe('NumberInput', () => {
  it('1: 渲染 type=number + value', () => {
    render(<NumberInput id="x" value={42} onChange={() => {}} />)
    const el = document.getElementById('x') as HTMLInputElement
    expect(el.type).toBe('number')
    expect(el.value).toBe('42')
  })

  it('2: 改數字 → onChange(number)', () => {
    const onChange = vi.fn()
    render(<NumberInput id="x" value={0} onChange={onChange} />)
    fireEvent.change(document.getElementById('x')!, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('3: 空字串 → NaN → 不 call onChange（避免 reset 為 NaN）', () => {
    const onChange = vi.fn()
    render(<NumberInput id="x" value={5} onChange={onChange} />)
    fireEvent.change(document.getElementById('x')!, { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('4: min / max / step 套到 element', () => {
    render(
      <NumberInput
        id="x"
        value={0}
        onChange={() => {}}
        min={-100}
        max={100}
        step={5}
      />,
    )
    const el = document.getElementById('x') as HTMLInputElement
    expect(el).toHaveAttribute('min', '-100')
    expect(el).toHaveAttribute('max', '100')
    expect(el).toHaveAttribute('step', '5')
  })
})
