'use client'

// Spec 009b v0.4 — sale-item purchase confirm form state + hook.
//
// Layout per spec: donorName + isAnonymous (no receiptOption — BE 022
// §4.3 SaleItemPurchaseBody does not accept it). Payload shape mirrors
// BE verbatim so a future BFF route can forward without translation
// (ADR 012). The `_endpoint` is a FE-side discriminator the BFF strips
// before forwarding.

import { useReducer, type Dispatch } from 'react'
import { toast } from 'sonner'
import type { ItemDetail } from '@/lib/schemas/detail'

// ─── Query (mirrors page.tsx Zod schema) ───────────────────────────

export type PurchaseCheckoutQuery = {
  saleItemId: string
  quantity: number
}

// ─── Form state ────────────────────────────────────────────────────

export interface FormState {
  donorName: string
  isAnonymous: boolean
}

export const DEFAULT_FORM: FormState = {
  donorName: '',
  isAnonymous: false,
}

export type Action =
  | { type: 'SET_DONOR_NAME'; value: string }
  | { type: 'SET_ANONYMOUS'; value: boolean }

export function reducer(s: FormState, a: Action): FormState {
  switch (a.type) {
    case 'SET_DONOR_NAME':
      return { ...s, donorName: a.value }
    case 'SET_ANONYMOUS':
      return { ...s, isAnonymous: a.value }
  }
}

// ─── Payload (BE 022 §4.3) ─────────────────────────────────────────

export type PurchaseConfirmPayload = {
  _endpoint: '/v1/donation/orders/sale-item-purchase'
  donorName: string
  isAnonymous: boolean
  items: [{ saleItemId: string; quantity: number }]
}

export function buildPayload(
  query: PurchaseCheckoutQuery,
  form: FormState,
): PurchaseConfirmPayload {
  return {
    _endpoint: '/v1/donation/orders/sale-item-purchase',
    donorName: form.donorName.trim(),
    isAnonymous: form.isAnonymous,
    items: [{ saleItemId: query.saleItemId, quantity: query.quantity }],
  }
}

// ─── Hook ──────────────────────────────────────────────────────────

export type UseReceiptInfoFormOpts = {
  query: PurchaseCheckoutQuery
  item: ItemDetail
}

export type UseReceiptInfoFormReturn = {
  form: FormState
  dispatch: Dispatch<Action>
  isValid: boolean
  subtotal: number
  shipping: number
  total: number
  handleSubmit: () => void
}

const DONOR_NAME_MAX = 120

export function useReceiptInfoForm(
  opts: UseReceiptInfoFormOpts,
): UseReceiptInfoFormReturn {
  const [form, dispatch] = useReducer(reducer, DEFAULT_FORM)
  const trimmed = form.donorName.trim()
  const isValid =
    trimmed.length > 0 && form.donorName.length <= DONOR_NAME_MAX

  // Derived totals — FE displays them, BE recomputes from SaleItem.priceTwd
  // snapshot at create time (BE 022 §4.3 internal behavior).
  const subtotal = opts.item.priceTwd * opts.query.quantity
  const shipping = 0
  const total = subtotal + shipping

  const handleSubmit = () => {
    if (!isValid) return
    const payload = buildPayload(opts.query, form)
    console.log('[checkout/purchase/confirm]', payload)
    toast.success('已送出（demo 不接金流）')
  }

  return { form, dispatch, isValid, subtotal, shipping, total, handleSubmit }
}
