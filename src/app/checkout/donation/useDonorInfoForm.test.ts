// Spec 009a v0.4 §8 — three-tier tests for useDonorInfoForm.
// R1-R3 reducer pure, H1-H8 hook integration.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const toastSuccessMock = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccessMock(...args) },
}))

import type { CharityDetail, DonationDetail } from '@/lib/schemas/detail'
import {
  DEFAULT_FORM,
  reducer,
  RECEIPT_OPTIONS,
  useDonorInfoForm,
  type DonationCheckoutQuery,
  type ReceiptOption,
} from './useDonorInfoForm'

const CHARITY_ID = '00000000-0000-4000-8000-000000000001'

const CHARITY_TARGET: CharityDetail = {
  id: CHARITY_ID,
  name: 'ACC 中華耆幼關懷協會',
  description: 'desc',
  contactPhone: undefined,
  contactEmail: undefined,
  officialWebsite: undefined,
  approvalNo: undefined,
  categories: [],
}

const PROJECT_TARGET: DonationDetail = {
  id: CHARITY_ID,
  name: '偏鄉AI 數位學習計畫',
  description: 'd',
  content: 'content',
  raisingApprovalNo: undefined,
  reliefApprovalNo: undefined,
  coverImageUrl: undefined,
  charity: {
    id: '00000000-0000-4000-8000-0000000000aa',
    name: '主辦團體 X',
  },
  categories: [],
}

const VALID_QUERY: DonationCheckoutQuery = {
  targetType: 'CHARITY',
  targetId: CHARITY_ID,
  donationFrequency: 'RECURRING',
  billingDay: 'DAY_16',
  amountTwd: 500,
}

beforeEach(() => {
  toastSuccessMock.mockReset()
})

// ─── R1-R3 reducer pure tests ─────────────────────────────────────

describe('reducer (pure)', () => {
  it('R1: SET_RECEIPT_OPTION INDIVIDUAL → state.receiptOption 更新', () => {
    const next = reducer(DEFAULT_FORM, {
      type: 'SET_RECEIPT_OPTION',
      value: 'INDIVIDUAL',
    })
    expect(next.receiptOption).toBe('INDIVIDUAL')
    expect(next.donorName).toBe('')
  })
  it('R2: SET_DONOR_NAME "Alice" → state.donorName="Alice"', () => {
    const next = reducer(DEFAULT_FORM, { type: 'SET_DONOR_NAME', value: 'Alice' })
    expect(next.donorName).toBe('Alice')
  })
  it('R3: SET_DONOR_NAME "" → state.donorName=""', () => {
    const seeded = reducer(DEFAULT_FORM, { type: 'SET_DONOR_NAME', value: 'A' })
    const next = reducer(seeded, { type: 'SET_DONOR_NAME', value: '' })
    expect(next.donorName).toBe('')
  })
})

describe('RECEIPT_OPTIONS', () => {
  it('長度 5、對齊 BE 022 §4.1 ReceiptOption enum', () => {
    expect(RECEIPT_OPTIONS).toHaveLength(5)
    const values = RECEIPT_OPTIONS.map((o) => o.value).sort()
    expect(values).toEqual(
      (['CORPORATE', 'DEFER', 'GOVERNMENT_DONATION', 'INDIVIDUAL', 'NONE'] as ReceiptOption[]).sort(),
    )
  })
})

// ─── H1-H8 hook integration ────────────────────────────────────────

describe('useDonorInfoForm (hook integration)', () => {
  it('H1: 初始 isValid=false（donorName=""、receiptOption="NONE"）', () => {
    const { result } = renderHook(() =>
      useDonorInfoForm({ query: VALID_QUERY, target: CHARITY_TARGET }),
    )
    expect(result.current.form).toEqual(DEFAULT_FORM)
    expect(result.current.isValid).toBe(false)
  })

  it('H2: SET_DONOR_NAME "Alice" → isValid=true', () => {
    const { result } = renderHook(() =>
      useDonorInfoForm({ query: VALID_QUERY, target: CHARITY_TARGET }),
    )
    act(() => result.current.dispatch({ type: 'SET_DONOR_NAME', value: 'Alice' }))
    expect(result.current.isValid).toBe(true)
  })

  it('H3: SET_DONOR_NAME "   " → isValid=false（trim 後空）', () => {
    const { result } = renderHook(() =>
      useDonorInfoForm({ query: VALID_QUERY, target: CHARITY_TARGET }),
    )
    act(() => result.current.dispatch({ type: 'SET_DONOR_NAME', value: '   ' }))
    expect(result.current.isValid).toBe(false)
  })

  it('H4: SET_DONOR_NAME 121 字 → isValid=false（BE 1-120 上限）', () => {
    const { result } = renderHook(() =>
      useDonorInfoForm({ query: VALID_QUERY, target: CHARITY_TARGET }),
    )
    const tooLong = 'a'.repeat(121)
    act(() => result.current.dispatch({ type: 'SET_DONOR_NAME', value: tooLong }))
    expect(result.current.isValid).toBe(false)
  })

  it('H5: handleSubmit (CHARITY) → toast.success + payload._endpoint = charity-donation + charityId 對齊', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useDonorInfoForm({ query: VALID_QUERY, target: CHARITY_TARGET }),
    )
    act(() => result.current.dispatch({ type: 'SET_DONOR_NAME', value: ' Alice ' }))
    act(() => result.current.handleSubmit())

    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const [, payload] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(payload._endpoint).toBe('/v1/donation/orders/charity-donation')
    expect(payload.charityId).toBe(CHARITY_ID)
    expect(payload.donorName).toBe('Alice')                    // trimmed
    expect(payload.isAnonymous).toBe(false)
    expect(payload.receiptOption).toBe('NONE')                  // default
    expect(payload.donationFrequency).toBe('RECURRING')
    expect(payload.billingDay).toBe('DAY_16')
    expect(payload.amountTwd).toBe(500)
    consoleSpy.mockRestore()
  })

  it('H6: handleSubmit (DONATION_PROJECT) → payload._endpoint = project-donation + donationProjectId', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const projectQuery: DonationCheckoutQuery = {
      ...VALID_QUERY,
      targetType: 'DONATION_PROJECT',
    }
    const { result } = renderHook(() =>
      useDonorInfoForm({ query: projectQuery, target: PROJECT_TARGET }),
    )
    act(() => result.current.dispatch({ type: 'SET_DONOR_NAME', value: 'Bob' }))
    act(() => result.current.handleSubmit())
    const [, payload] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(payload._endpoint).toBe('/v1/donation/orders/project-donation')
    expect(payload.donationProjectId).toBe(CHARITY_ID)
    expect('charityId' in payload).toBe(false)
    consoleSpy.mockRestore()
  })

  it('H7: handleSubmit (!isValid) → toast 不被叫', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useDonorInfoForm({ query: VALID_QUERY, target: CHARITY_TARGET }),
    )
    act(() => result.current.handleSubmit())
    expect(toastSuccessMock).not.toHaveBeenCalled()
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('H8: donationFrequency=ONE_TIME → payload 不含 billingDay 欄位（BE 規約）', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const oneTimeQuery: DonationCheckoutQuery = {
      targetType: 'CHARITY',
      targetId: CHARITY_ID,
      donationFrequency: 'ONE_TIME',
      amountTwd: 1000,
    }
    const { result } = renderHook(() =>
      useDonorInfoForm({ query: oneTimeQuery, target: CHARITY_TARGET }),
    )
    act(() => result.current.dispatch({ type: 'SET_DONOR_NAME', value: 'C' }))
    act(() => result.current.handleSubmit())
    const [, payload] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(payload.donationFrequency).toBe('ONE_TIME')
    expect('billingDay' in payload).toBe(false)
    consoleSpy.mockRestore()
  })
})
