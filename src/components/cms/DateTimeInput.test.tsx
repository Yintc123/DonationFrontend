import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import {
  DateTimeInput,
  isoToLocalInput,
  localInputToIso,
} from './DateTimeInput'

describe('isoToLocalInput / localInputToIso (pure)', () => {
  it('isoToLocalInput: 空字串 → 空字串', () => {
    expect(isoToLocalInput('')).toBe('')
  })

  it('isoToLocalInput: 無效 ISO → 空字串', () => {
    expect(isoToLocalInput('garbage')).toBe('')
  })

  it('round-trip: ISO → local → ISO 相等（去秒）', () => {
    const iso = '2026-06-16T03:00:00.000Z'
    const local = isoToLocalInput(iso)
    const back = localInputToIso(local)
    expect(back).toBe(iso)
  })

  it('localInputToIso: 空字串 → 空字串', () => {
    expect(localInputToIso('')).toBe('')
  })
})

describe('DateTimeInput', () => {
  it('1: 渲染 type=datetime-local', () => {
    render(<DateTimeInput id="x" value="" onChange={() => {}} />)
    expect(document.getElementById('x')).toHaveAttribute('type', 'datetime-local')
  })

  it('2: value 空字串 → element value 空', () => {
    render(<DateTimeInput id="x" value="" onChange={() => {}} />)
    expect((document.getElementById('x') as HTMLInputElement).value).toBe('')
  })

  it('3: 輸入 local → onChange(ISO)', () => {
    const onChange = vi.fn()
    render(<DateTimeInput id="x" value="" onChange={onChange} />)
    fireEvent.change(document.getElementById('x')!, {
      target: { value: '2026-06-16T11:00' },
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    // 收到的應該是 ISO 字串
    expect(onChange.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
