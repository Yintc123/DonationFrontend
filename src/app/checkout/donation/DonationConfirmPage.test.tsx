// Spec 009a v0.4 §8.3 — DonationConfirmPage visual/integration tests.
// useDonorInfoForm has its own pure + hook tests; this file pins composition:
// shell + detail panel + donor panel + sticky CTA.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharityDetail, DonationDetail } from '@/lib/schemas/detail'

const toastSuccessMock = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),    // v0.5 — hook router.replace 導回 entry detail
  }),
  usePathname: () => '/checkout/donation',
}))

import { DonationConfirmPage } from './DonationConfirmPage'

const CHARITY_ID = '00000000-0000-4000-8000-000000000001'

const CHARITY: CharityDetail = {
  id: CHARITY_ID,
  name: 'ACC 中華耆幼關懷協會',
  description: 'desc',
  categories: [],
}

const PROJECT: DonationDetail = {
  id: CHARITY_ID,
  name: '偏鄉AI 數位學習計畫－給孩子一雙探索未來的雙手',
  description: 'd',
  content: 'long content',
  charity: {
    id: '00000000-0000-4000-8000-0000000000aa',
    name: '財團法人菩提社會福利慈善事業基金會',
  },
  categories: [],
}

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  toastSuccessMock.mockReset()
  fetchMock.mockReset().mockResolvedValue(
    new Response(
      JSON.stringify({ data: { orderId: 'ord-1', status: 'PENDING' } }),
      { status: 200 },
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// v0.7 — DonationConfirmPage props collapsed to `draft`. These helpers
// keep each test focused on the variant it cares about.
import type { DonationDraft } from './draft-store'

const CHARITY_DRAFT_RECURRING: DonationDraft = {
  donationFrequency: 'RECURRING',
  billingDay: 'DAY_16',
  amountTwd: 500,
  target: { type: 'CHARITY', detail: CHARITY },
}
const CHARITY_DRAFT_ONE_TIME: DonationDraft = {
  donationFrequency: 'ONE_TIME',
  amountTwd: 100,
  target: { type: 'CHARITY', detail: CHARITY },
}
const PROJECT_DRAFT_RECURRING: DonationDraft = {
  donationFrequency: 'RECURRING',
  billingDay: 'DAY_6',
  amountTwd: 100,
  target: { type: 'DONATION_PROJECT', detail: PROJECT },
}

describe('DonationConfirmPage', () => {
  it('1: charity 直捐 RECURRING → 顯示「直接捐款給團體」+ 團體名 + 扣款週期 + 下次扣款日期 + TWD 金額', () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_RECURRING} />)
    expect(screen.getByText('直接捐款給團體')).toBeInTheDocument()
    expect(screen.getByText('ACC 中華耆幼關懷協會')).toBeInTheDocument()
    expect(screen.getByText('定期捐款')).toBeInTheDocument()
    expect(screen.getByText('每月 16 日')).toBeInTheDocument()
    expect(screen.getByText(/\d{4}\/\d{2}\/\d{2}/)).toBeInTheDocument()
    expect(screen.getByText(/TWD\s*500/)).toBeInTheDocument()
  })

  it('2: project 捐款 → 顯示專案名（捐款專案）+ 主辦團體名（捐款對象）', () => {
    render(<DonationConfirmPage draft={PROJECT_DRAFT_RECURRING} />)
    expect(
      screen.getByText('偏鄉AI 數位學習計畫－給孩子一雙探索未來的雙手'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('財團法人菩提社會福利慈善事業基金會'),
    ).toBeInTheDocument()
  })

  it('3: ONE_TIME → 扣款週期 / 下次扣款日期 row 不渲染', () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_ONE_TIME} />)
    expect(screen.getByText('單次捐款')).toBeInTheDocument()
    expect(screen.queryByText('扣款週期')).toBeNull()
    expect(screen.queryByText('下次扣款日期')).toBeNull()
  })

  it('4 (v0.9): 初始 → 捐款人姓名 input 不渲染；先選收據方式才出現', async () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_ONE_TIME} />)
    expect(screen.queryByLabelText(/捐款人姓名/)).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /匿名捐款/ })).toBeNull()

    // 選 receiptOption 後姓名 input 出現
    const select = screen.getByLabelText(/收據開立方式/) as HTMLSelectElement
    await userEvent.selectOptions(select, 'NONE')
    expect(screen.getByLabelText(/捐款人姓名/)).toBeInTheDocument()
  })

  it('4b (v0.9): sticky CTA「確認捐款」收據未選 disabled；選後填姓名才 enabled', async () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_ONE_TIME} />)
    const submit = screen.getByRole('button', { name: '確認捐款' })
    expect(submit).toBeDisabled()

    // 只選收據還不夠，仍 disabled
    const select = screen.getByLabelText(/收據開立方式/) as HTMLSelectElement
    await userEvent.selectOptions(select, 'NONE')
    expect(submit).toBeDisabled()

    // 填姓名後 enabled
    await userEvent.type(screen.getByLabelText(/捐款人姓名/), 'Alice')
    expect(submit).toBeEnabled()
  })

  it('5: 填齊後送出 → toast.success', async () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_ONE_TIME} />)
    await userEvent.selectOptions(
      screen.getByLabelText(/收據開立方式/),
      'NONE',
    )
    await userEvent.type(screen.getByLabelText(/捐款人姓名/), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: '確認捐款' }))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/checkout/donation',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
  })

  it('5b (v0.8): 選收據後「我要匿名捐款」checkbox 出現 + 預設未勾', async () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_ONE_TIME} />)
    await userEvent.selectOptions(
      screen.getByLabelText(/收據開立方式/),
      'NONE',
    )
    const checkbox = screen.getByRole('checkbox', { name: /匿名捐款/ })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  it('5c (v0.8): 勾匿名 checkbox → state 翻轉', async () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_ONE_TIME} />)
    await userEvent.selectOptions(
      screen.getByLabelText(/收據開立方式/),
      'NONE',
    )
    const checkbox = screen.getByRole('checkbox', { name: /匿名捐款/ })
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('5d (009d): 選收據後 → 「什麼是匿名捐款？」trigger 出現；點之 → dialog 跳、不誤觸 checkbox', async () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_ONE_TIME} />)
    await userEvent.selectOptions(
      screen.getByLabelText(/收據開立方式/),
      'NONE',
    )
    const checkbox = screen.getByRole('checkbox', { name: /匿名捐款/ })
    const infoTrigger = screen.getByRole('button', {
      name: '什麼是匿名捐款？',
    })
    expect(checkbox).not.toBeChecked()
    await userEvent.click(infoTrigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // 整合風險：button 嵌在 label 內，click 不該 propagate 觸發 checkbox
    expect(checkbox).not.toBeChecked()
  })

  it('6 (v0.9): <select> 含 5 個 BE enum + 1 個 placeholder（共 6 options，第一個 disabled）', () => {
    render(<DonationConfirmPage draft={CHARITY_DRAFT_ONE_TIME} />)
    const select = screen.getByLabelText(/收據開立方式/) as HTMLSelectElement
    expect(select.options).toHaveLength(6) // placeholder + 5 BE enums
    // placeholder 是第一個、disabled、value=''
    expect(select.options[0].value).toBe('')
    expect(select.options[0].disabled).toBe(true)
    expect(Array.from(select.options).slice(1).map((o) => o.value)).toEqual([
      'NONE',
      'INDIVIDUAL',
      'CORPORATE',
      'GOVERNMENT_DONATION',
      'DEFER',
    ])
  })
})
