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

test('lateral nav：item 詳情 → 查看團體 → 按返回直接回 list (skip item 詳情)', async ({
  page,
}) => {
  // 從 list 進義賣商品詳情（這步是 push）
  await page.goto('/donation?tab=item')
  await page.getByRole('tab', { name: '義賣商品' }).click()
  await page.getByRole('heading', {
    level: 2,
    name: '北歐天然｜貝比D - 液體維生素D3食品',
  }).click()
  await expect(page).toHaveURL(/\/sale-items\//)

  // 點「查看團體 ›」（這步是 replace — 不堆 history）
  await page.getByRole('link', { name: /查看團體/ }).click()
  await expect(page).toHaveURL(/\/charities\//)

  // 按返回 → 直接回 list (跳過 /sale-items)，且 tab 還原為 item
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page).toHaveURL(/\/donation\?[^#]*tab=item/)
  // 應該不是 /sale-items 詳情頁
  await expect(page).not.toHaveURL(/\/sale-items\//)
})

test('detail page 未知 id → Next not-found', async ({ page }) => {
  const res = await page.goto(
    '/charities/00000000-0000-0000-0000-000000000000',
  )
  // Next 16 notFound() 預設回傳 404 status
  expect(res?.status()).toBe(404)
})
