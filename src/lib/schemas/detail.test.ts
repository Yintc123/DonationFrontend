// Spec 004 — detail schema mappers convert backend nulls to omitted keys
// + flatten inflated categories the way the client expects.

import { describe, expect, it } from 'vitest'

import {
  BackendCharityDetail,
  BackendDonationDetail,
  BackendItemDetail,
  toClientCharityDetail,
  toClientDonationDetail,
  toClientItemDetail,
} from './detail'

const UUID = '00000000-0000-4000-8000-000000000001'
const UUID2 = '00000000-0000-4000-8000-000000000002'
const CAT = { id: 'cat-1', key: 'child_care' as const, displayName: '兒少照護' }

describe('BackendCharityDetail Zod', () => {
  it('accepts spec 017 §3 shape with null nullable fields', () => {
    expect(() =>
      BackendCharityDetail.parse({
        id: UUID,
        name: 'ACC',
        description: 'desc',
        logoUrl: null,
        contactPhone: null,
        contactEmail: null,
        officialWebsite: null,
        approvalNo: null,
        categories: [CAT],
        createdAt: '2026-06-14T00:00:00Z',
        updatedAt: '2026-06-14T00:00:00Z',
      }),
    ).not.toThrow()
  })

  it('rejects a missing nullable field (backend always emits the key)', () => {
    expect(() =>
      BackendCharityDetail.parse({
        id: UUID,
        name: 'X',
        description: 'd',
        // contactPhone OMITTED — spec 009 §4.4 v0.2 forbids this
        logoUrl: null,
        contactEmail: null,
        officialWebsite: null,
        approvalNo: null,
        categories: [],
        createdAt: '2026-06-14T00:00:00Z',
        updatedAt: '2026-06-14T00:00:00Z',
      }),
    ).toThrow()
  })
})

describe('toClientCharityDetail', () => {
  it('drops null fields, strips createdAt/updatedAt, preserves inflated categories', () => {
    const out = toClientCharityDetail({
      id: UUID,
      name: 'ACC',
      description: 'desc',
      logoUrl: 'https://cdn.example.com/logo.png',
      contactPhone: '02-12345678',
      contactEmail: null,
      officialWebsite: null,
      approvalNo: '台內團字第1號',
      categories: [CAT],
      createdAt: '2026-06-14T00:00:00Z',
      updatedAt: '2026-06-14T00:00:00Z',
    })
    expect(out).toEqual({
      id: UUID,
      name: 'ACC',
      description: 'desc',
      logoUrl: 'https://cdn.example.com/logo.png',
      contactPhone: '02-12345678',
      approvalNo: '台內團字第1號',
      categories: [CAT],
    })
    expect(out).not.toHaveProperty('contactEmail')
    expect(out).not.toHaveProperty('officialWebsite')
    expect(out).not.toHaveProperty('createdAt')
  })
})

describe('toClientDonationDetail', () => {
  it('flattens nested charity, drops null URLs, keeps required content', () => {
    const out = toClientDonationDetail({
      id: UUID,
      name: 'Project',
      description: 'd',
      logoUrl: null,
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
      content: '完整內容',
      raisingApprovalNo: '勸募字號',
      reliefApprovalNo: null,
      charity: { id: UUID2, name: 'Parent', logoUrl: null },
      categories: [CAT],
      createdAt: '2026-06-14T00:00:00Z',
      updatedAt: '2026-06-14T00:00:00Z',
    })
    expect(out.coverImageUrl).toBe('https://cdn.example.com/cover.jpg')
    expect(out).not.toHaveProperty('logoUrl')
    expect(out.content).toBe('完整內容')
    expect(out.raisingApprovalNo).toBe('勸募字號')
    expect(out).not.toHaveProperty('reliefApprovalNo')
    expect(out.charity).toEqual({ id: UUID2, name: 'Parent' })
    expect(out.charity).not.toHaveProperty('logoUrl')
  })
})

describe('toClientItemDetail', () => {
  it('preserves priceTwd=0 as a valid number (not dropped)', () => {
    const out = toClientItemDetail({
      id: UUID,
      name: 'Item',
      description: 'd',
      logoUrl: null,
      coverImageUrl: null,
      content: 'c',
      priceTwd: 0,
      raisingApprovalNo: null,
      reliefApprovalNo: null,
      charity: { id: UUID2, name: 'P', logoUrl: null },
      categories: [],
      createdAt: '2026-06-14T00:00:00Z',
      updatedAt: '2026-06-14T00:00:00Z',
    })
    expect(out.priceTwd).toBe(0)
    expect(out.categories).toEqual([])
  })
})

describe('BackendDonationDetail / BackendItemDetail', () => {
  it('require `content` (long-form) since spec 017 says it is always non-null', () => {
    expect(() =>
      BackendDonationDetail.parse({
        id: UUID,
        name: 'P',
        description: 'd',
        logoUrl: null,
        coverImageUrl: null,
        // content missing
        raisingApprovalNo: null,
        reliefApprovalNo: null,
        charity: { id: UUID2, name: 'P', logoUrl: null },
        categories: [],
        createdAt: '2026-06-14T00:00:00Z',
        updatedAt: '2026-06-14T00:00:00Z',
      }),
    ).toThrow()
  })

  it('rejects negative priceTwd', () => {
    expect(() =>
      BackendItemDetail.parse({
        id: UUID,
        name: 'I',
        description: 'd',
        logoUrl: null,
        coverImageUrl: null,
        content: 'c',
        priceTwd: -1,
        raisingApprovalNo: null,
        reliefApprovalNo: null,
        charity: { id: UUID2, name: 'P', logoUrl: null },
        categories: [],
        createdAt: '2026-06-14T00:00:00Z',
        updatedAt: '2026-06-14T00:00:00Z',
      }),
    ).toThrow()
  })
})
