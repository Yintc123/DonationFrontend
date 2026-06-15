// Spec 008c v0.7 §7.2 — hook integration tests for usePurchaseQtyForm.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ItemDetail } from '@/lib/schemas/detail'

const routerPushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

import * as DraftStore from './purchase/draft-store'
import { usePurchaseQtyForm } from './usePurchaseQtyForm'

const ITEM: ItemDetail = {
  id: '00000000-0000-4000-8000-000000000099',
  name: '陸仕私廚 藤椒牛肉麵',
  description: '760g 袋（冷凍）',
  content: '',
  priceTwd: 449,
  charity: { id: 'cha-1', name: '台灣紅絲帶基金會' },
  categories: [],
}

let setDraftSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  routerPushMock.mockReset()
  DraftStore._resetPurchaseDraftForTest()
  setDraftSpy = vi.spyOn(DraftStore, 'setPurchaseDraft')
  setDraftSpy.mockClear()
})

describe('usePurchaseQtyForm', () => {
  it('H1: 初始 quantity=1、subtotal=priceTwd、shipping=0、total=subtotal', () => {
    const { result } = renderHook(() =>
      usePurchaseQtyForm({ open: true, item: ITEM, onClose: vi.fn() }),
    )
    expect(result.current.quantity).toBe(1)
    expect(result.current.subtotal).toBe(449)
    expect(result.current.shipping).toBe(0)
    expect(result.current.total).toBe(449)
  })

  it('H2: setQuantity(4) → quantity / subtotal / total 重算', () => {
    const { result } = renderHook(() =>
      usePurchaseQtyForm({ open: true, item: ITEM, onClose: vi.fn() }),
    )
    act(() => result.current.setQuantity(4))
    expect(result.current.quantity).toBe(4)
    expect(result.current.subtotal).toBe(449 * 4)
    expect(result.current.total).toBe(449 * 4)
  })

  it('H3 (v0.7): handleSubmit → setPurchaseDraft({ quantity, item }) + router.push("/checkout/purchase") + onClose 被叫', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() =>
      usePurchaseQtyForm({ open: true, item: ITEM, onClose }),
    )
    act(() => result.current.setQuantity(3))
    act(() => result.current.handleSubmit())

    expect(setDraftSpy).toHaveBeenCalledTimes(1)
    expect(setDraftSpy).toHaveBeenCalledWith({ quantity: 3, item: ITEM })
    expect(routerPushMock).toHaveBeenCalledWith('/checkout/purchase')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('H4: opts.open false → true rerender → quantity 重置（先 setQuantity(5)）', () => {
    const { result, rerender } = renderHook(
      (props: { open: boolean }) =>
        usePurchaseQtyForm({
          open: props.open,
          item: ITEM,
          onClose: vi.fn(),
        }),
      { initialProps: { open: true } },
    )
    act(() => result.current.setQuantity(5))
    expect(result.current.quantity).toBe(5)

    rerender({ open: false })
    rerender({ open: true })
    expect(result.current.quantity).toBe(1)
  })
})
