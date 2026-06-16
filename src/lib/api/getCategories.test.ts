import { describe, it, expect, vi, beforeEach } from 'vitest'

const backendFetchMock = vi.fn()
vi.mock('./backend', () => ({
  backendFetch: (...args: unknown[]) => backendFetchMock(...args),
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'accept-language': 'zh-TW' }),
}))

import { fetchCategories } from './getCategories'

beforeEach(() => {
  backendFetchMock.mockReset()
})

describe('fetchCategories', () => {
  it('forwards GET /user/v1/donation/categories with accept-language', async () => {
    backendFetchMock.mockResolvedValue({
      data: {
        items: [
          { id: 'c1', key: 'child_care', displayName: '兒少照護', displayOrder: 0 },
        ],
      },
    })
    const items = await fetchCategories()
    expect(backendFetchMock).toHaveBeenCalledWith(
      '/user/v1/donation/categories',
      expect.objectContaining({
        headers: { 'accept-language': 'zh-TW' },
      }),
    )
    expect(items).toEqual([
      { id: 'c1', key: 'child_care', displayName: '兒少照護', displayOrder: 0 },
    ])
  })

  it('throws ContractViolationError on bad shape', async () => {
    backendFetchMock.mockResolvedValue({ data: { bogus: true } })
    await expect(fetchCategories()).rejects.toThrow(/categories.*schema/i)
  })
})
