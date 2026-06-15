import { test, expect } from '@playwright/test'

const CHARITY_ID = '11111111-1111-4111-8111-000000000001'
const DONATION_ID = '22222222-2222-4222-8222-000000000001'
const ITEM_ID = '33333333-3333-4333-8333-000000000001'

test('點公益團體卡 → 進入詳情頁顯示 公益團體介紹 TopNav + 直接捐款給團體 CTA', async ({
  page,
}) => {
  await page.goto('/donation')
  await page.getByRole('heading', { level: 2, name: 'ACC 中華耆幼關懷協會' }).click()
  await expect(page).toHaveURL(new RegExp(`/charities/${CHARITY_ID}`))
  await expect(
    page.getByRole('heading', { level: 1, name: 'ACC 中華耆幼關懷協會' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '直接捐款給團體' })).toBeVisible()
})

test('直接訪問 charity detail URL 顯示完整內容', async ({ page }) => {
  await page.goto(`/charities/${CHARITY_ID}`)
  // TopNav title
  await expect(
    page.getByRole('heading', { level: 1, name: 'ACC 中華耆幼關懷協會' }),
  ).toBeVisible()
  // 基本資料 section
  await expect(page.getByRole('heading', { level: 2, name: '基本資料' })).toBeVisible()
})

test('直接訪問 donation project detail URL', async ({ page }) => {
  await page.goto(`/donation-projects/${DONATION_ID}`)
  // TopNav h1 是「捐款專案介紹」、content h1 是專案標題；用 .last() 取 content
  await expect(page.getByRole('heading', { level: 1 }).last()).toContainText('安居')
  await expect(page.getByRole('button', { name: '立即捐款' })).toBeVisible()
})

test('直接訪問 sale item detail URL 顯示 TWD 價格 + 公益義賣 ribbon', async ({
  page,
}) => {
  await page.goto(`/sale-items/${ITEM_ID}`)
  await expect(page.getByText('TWD 1,000')).toBeVisible()
  await expect(page.getByText('公益義賣')).toBeVisible()
  await expect(page.getByRole('button', { name: '立即捐款' })).toBeVisible()
})

test('進詳情頁後按 TopNav 返回 → 回到 list 頁', async ({ page }) => {
  await page.goto('/donation')
  await page.getByRole('heading', { level: 2, name: 'ACC 中華耆幼關懷協會' }).click()
  await expect(page).toHaveURL(new RegExp(`/charities/${CHARITY_ID}`))
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page).toHaveURL(/\/donation$/)
})

test('lateral nav：item 詳情 → 查看團體 → 按返回回到 item 詳情（spec 004 §3.1 v0.3）', async ({
  page,
}) => {
  // 從 list 進義賣商品詳情（push）
  await page.goto('/donation?tab=item')
  await page.getByRole('tab', { name: '義賣商品' }).click()
  await page.getByRole('heading', { level: 2 }).first().click()
  await expect(page).toHaveURL(/\/sale-items\//)
  const itemDetailUrl = page.url()

  // 點「查看團體 ›」(spec 004 §3.1 v0.3：預設 push、不再 replace)
  await page.getByRole('link', { name: /查看團體/ }).click()
  await expect(page).toHaveURL(/\/charities\//)

  // 按 1 次返回 → 回到 /sale-items 詳情頁（不再跳過、不直接回 list）
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page).toHaveURL(itemDetailUrl)

  // 再按一次才回 list
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page).toHaveURL(/\/donation\?[^#]*tab=item/)
})

test('detail page 未知 id → Next not-found', async ({ page }) => {
  const res = await page.goto(
    '/charities/00000000-0000-0000-0000-000000000000',
  )
  // Next 16 notFound() 預設回傳 404 status
  expect(res?.status()).toBe(404)
})
