'use client'

// Spec 009a v0.4 — donation confirm page (charity + project share this UI).
// Pure UI layer composing 009c primitives + business panels; all logic
// lives in useDonorInfoForm.

import type { Dispatch } from 'react'
import { ConfirmPageShell } from '@/components/ui/ConfirmPageShell'
import { ConfirmPanel } from '@/components/ui/ConfirmPanel'
import { KeyValueList, KeyValueRow } from '@/components/ui/KeyValueList'
import {
  DisclaimerBox,
  DISCLAIMER_PLATFORM,
} from '@/components/ui/DisclaimerBox'
import { RequiredLabel } from '@/components/ui/RequiredLabel'
import type { CharityDetail, DonationDetail } from '@/lib/schemas/detail'
import { computeNextChargeAt, fmtDate } from './computeNextChargeAt'
import {
  useDonorInfoForm,
  RECEIPT_OPTIONS,
  type Action,
  type DonationCheckoutQuery,
  type FormState,
  type ReceiptOption,
} from './useDonorInfoForm'
import type { BillingDay } from '../useDonationSettingsForm'

type Props = {
  query: DonationCheckoutQuery
  target: CharityDetail | DonationDetail
}

const BILLING_DAY_LABEL: Record<BillingDay, number> = {
  DAY_6: 6,
  DAY_16: 16,
  DAY_26: 26,
}

const priceFmt = new Intl.NumberFormat('zh-TW')

export function DonationConfirmPage({ query, target }: Props) {
  const { form, dispatch, isValid, handleSubmit } = useDonorInfoForm({
    query,
    target,
  })
  return (
    <ConfirmPageShell
      title="確認捐款資訊"
      ctaLabel="確認送出"
      isValid={isValid}
      onSubmit={handleSubmit}
    >
      <DonationDetailPanel query={query} target={target} />
      <DonorInfoFormPanel form={form} dispatch={dispatch} />
    </ConfirmPageShell>
  )
}

function DonationDetailPanel({ query, target }: Props) {
  const projectName =
    query.targetType === 'CHARITY'
      ? '直接捐款給團體'
      : (target as DonationDetail).name
  const charityName =
    query.targetType === 'CHARITY'
      ? (target as CharityDetail).name
      : (target as DonationDetail).charity.name
  const typeLabel =
    query.donationFrequency === 'RECURRING' ? '定期捐款' : '單次捐款'
  const nextChargeAt =
    query.donationFrequency === 'RECURRING' && query.billingDay
      ? computeNextChargeAt(query.billingDay)
      : null

  return (
    <ConfirmPanel title="捐款明細" variant="first">
      <KeyValueList>
        <KeyValueRow label="捐款專案">{projectName}</KeyValueRow>
        <KeyValueRow label="捐款對象">{charityName}</KeyValueRow>
        <KeyValueRow label="捐款類型">{typeLabel}</KeyValueRow>
        {query.donationFrequency === 'RECURRING' && query.billingDay && (
          <>
            <KeyValueRow label="扣款週期">
              每月 {BILLING_DAY_LABEL[query.billingDay]} 日
            </KeyValueRow>
            <KeyValueRow label="下次扣款日期">
              <time dateTime={nextChargeAt!.toISOString().slice(0, 10)}>
                {fmtDate(nextChargeAt!)}
              </time>
            </KeyValueRow>
          </>
        )}
        <KeyValueRow label="捐款金額" variant="emphasized">
          TWD {priceFmt.format(query.amountTwd)}
        </KeyValueRow>
      </KeyValueList>
    </ConfirmPanel>
  )
}

function DonorInfoFormPanel({
  form,
  dispatch,
}: {
  form: FormState
  dispatch: Dispatch<Action>
}) {
  return (
    <ConfirmPanel title="捐款人基本資料">
      <DisclaimerBox className="mb-4">{DISCLAIMER_PLATFORM}</DisclaimerBox>

      <RequiredLabel htmlFor="receiptOption" className="mb-2">
        收據開立方式
      </RequiredLabel>
      <select
        id="receiptOption"
        value={form.receiptOption}
        onChange={(e) =>
          dispatch({
            type: 'SET_RECEIPT_OPTION',
            value: e.target.value as ReceiptOption,
          })
        }
        className="w-full h-12 rounded-lg border border-line bg-surface-card
                   px-3 text-sm text-ink-AAA mb-4"
      >
        {RECEIPT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <RequiredLabel htmlFor="donorName" className="mb-2">
        捐款人姓名
      </RequiredLabel>
      <input
        id="donorName"
        type="text"
        maxLength={120}
        placeholder="請填寫姓名"
        value={form.donorName}
        onChange={(e) =>
          dispatch({ type: 'SET_DONOR_NAME', value: e.target.value })
        }
        className="w-full h-12 rounded-lg border border-line bg-surface-card
                   px-3 text-sm text-ink-AAA placeholder:text-ink-A
                   focus:border-2 focus:border-ink-AAA focus:outline-none"
      />
    </ConfirmPanel>
  )
}
