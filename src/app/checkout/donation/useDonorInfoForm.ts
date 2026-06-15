'use client'

// Spec 009a v0.4 — DonorInfo form state + hook.
//
// Pure layer: reducer + RECEIPT_OPTIONS + buildPayload. Hook layer wraps
// useReducer + isValid + handleSubmit (console.log + sonner toast — brief
// "不接金流" placeholder).
//
// Naming and shape follow ADR 012 / BE 022 §4.1 (charity-donation) and
// §4.2 (project-donation) verbatim. A `_endpoint` discriminator on the
// payload tells the future BFF which endpoint to forward to; BE strips
// underscore-prefixed fields via TypeBox `additionalProperties: false`,
// so the BFF must remove it before sending.

import { useReducer, type Dispatch } from 'react'
import { toast } from 'sonner'
import type { CharityDetail, DonationDetail } from '@/lib/schemas/detail'

// ─── BE-aligned types ──────────────────────────────────────────────

export type ReceiptOption =
  | 'NONE'
  | 'INDIVIDUAL'
  | 'CORPORATE'
  | 'GOVERNMENT_DONATION'
  | 'DEFER'

export const RECEIPT_OPTIONS: { value: ReceiptOption; label: string }[] = [
  { value: 'NONE', label: '都不需要' },
  { value: 'INDIVIDUAL', label: '個人' },
  { value: 'CORPORATE', label: '公司' },
  { value: 'GOVERNMENT_DONATION', label: '政府捐款抵稅' },
  { value: 'DEFER', label: '稍後決定' },
]

export const DEFAULT_RECEIPT_OPTION: ReceiptOption = 'NONE'

export type DonationCheckoutQuery = {
  targetType: 'CHARITY' | 'DONATION_PROJECT'
  targetId: string
  donationFrequency: 'ONE_TIME' | 'RECURRING'
  billingDay?: 'DAY_6' | 'DAY_16' | 'DAY_26'
  amountTwd: number
}

// ─── Form state ────────────────────────────────────────────────────

export interface FormState {
  receiptOption: ReceiptOption
  donorName: string
}

export const DEFAULT_FORM: FormState = {
  receiptOption: DEFAULT_RECEIPT_OPTION,
  donorName: '',
}

export type Action =
  | { type: 'SET_RECEIPT_OPTION'; value: ReceiptOption }
  | { type: 'SET_DONOR_NAME'; value: string }

export function reducer(s: FormState, a: Action): FormState {
  switch (a.type) {
    case 'SET_RECEIPT_OPTION':
      return { ...s, receiptOption: a.value }
    case 'SET_DONOR_NAME':
      return { ...s, donorName: a.value }
  }
}

// ─── Payload (BE 022 §4.1 / §4.2) ──────────────────────────────────

type CharityDonationPayload = {
  _endpoint: '/v1/donation/orders/charity-donation'
  donorName: string
  isAnonymous: false
  receiptOption: ReceiptOption
  charityId: string
  donationFrequency: 'ONE_TIME' | 'RECURRING'
  billingDay?: 'DAY_6' | 'DAY_16' | 'DAY_26'
  amountTwd: number
}

type ProjectDonationPayload = {
  _endpoint: '/v1/donation/orders/project-donation'
  donorName: string
  isAnonymous: false
  receiptOption: ReceiptOption
  donationProjectId: string
  donationFrequency: 'ONE_TIME' | 'RECURRING'
  billingDay?: 'DAY_6' | 'DAY_16' | 'DAY_26'
  amountTwd: number
}

export type DonationConfirmPayload = CharityDonationPayload | ProjectDonationPayload

export function buildPayload(
  query: DonationCheckoutQuery,
  _target: CharityDetail | DonationDetail,
  form: FormState,
): DonationConfirmPayload {
  const base = {
    donorName: form.donorName.trim(),
    isAnonymous: false as const,
    receiptOption: form.receiptOption,
    donationFrequency: query.donationFrequency,
    ...(query.billingDay !== undefined && { billingDay: query.billingDay }),
    amountTwd: query.amountTwd,
  }
  if (query.targetType === 'CHARITY') {
    return {
      _endpoint: '/v1/donation/orders/charity-donation',
      ...base,
      charityId: query.targetId,
    }
  }
  return {
    _endpoint: '/v1/donation/orders/project-donation',
    ...base,
    donationProjectId: query.targetId,
  }
}

// ─── Hook ──────────────────────────────────────────────────────────

export type UseDonorInfoFormOpts = {
  query: DonationCheckoutQuery
  target: CharityDetail | DonationDetail
}

export type UseDonorInfoFormReturn = {
  form: FormState
  dispatch: Dispatch<Action>
  isValid: boolean
  handleSubmit: () => void
}

const DONOR_NAME_MAX = 120 // matches BE 022 §4.1 donorName maxLength

export function useDonorInfoForm(
  opts: UseDonorInfoFormOpts,
): UseDonorInfoFormReturn {
  const [form, dispatch] = useReducer(reducer, DEFAULT_FORM)
  const trimmed = form.donorName.trim()
  const isValid =
    trimmed.length > 0 && form.donorName.length <= DONOR_NAME_MAX

  const handleSubmit = () => {
    if (!isValid) return
    const payload = buildPayload(opts.query, opts.target, form)
    // brief.md「不接金流」placeholder：log + toast，未來改 router.push 付款頁
    console.log('[checkout/donation/confirm]', payload)
    toast.success('已送出（demo 不接金流）')
  }

  return { form, dispatch, isValid, handleSubmit }
}
