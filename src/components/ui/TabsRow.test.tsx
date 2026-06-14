import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TabsRow } from './TabsRow'

describe('TabsRow', () => {
  it('渲染三個 tab：公益團體 / 捐款專案 / 義賣商品', () => {
    render(<TabsRow active="charity" onTabChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '公益團體' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '捐款專案' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '義賣商品' })).toBeInTheDocument()
  })

  it('active="charity" → 公益團體 aria-selected=true、其他 false', () => {
    render(<TabsRow active="charity" onTabChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '公益團體' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '捐款專案' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: '義賣商品' })).toHaveAttribute('aria-selected', 'false')
  })

  it('active="donation" → 捐款專案 aria-selected=true', () => {
    render(<TabsRow active="donation" onTabChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '捐款專案' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '公益團體' })).toHaveAttribute('aria-selected', 'false')
  })

  it('active="item" → 義賣商品 aria-selected=true', () => {
    render(<TabsRow active="item" onTabChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '義賣商品' })).toHaveAttribute('aria-selected', 'true')
  })

  it('點 tab → onTabChange 收到對應 key', async () => {
    const onTabChange = vi.fn()
    render(<TabsRow active="charity" onTabChange={onTabChange} />)
    await userEvent.click(screen.getByRole('tab', { name: '捐款專案' }))
    expect(onTabChange).toHaveBeenCalledWith('donation')
  })

  it('點已 active 的 tab 仍呼叫 onTabChange（父層自決定）', async () => {
    const onTabChange = vi.fn()
    render(<TabsRow active="charity" onTabChange={onTabChange} />)
    await userEvent.click(screen.getByRole('tab', { name: '公益團體' }))
    expect(onTabChange).toHaveBeenCalledWith('charity')
  })

  it('三個 tab 都沒 disabled', () => {
    render(<TabsRow active="charity" onTabChange={() => {}} />)
    for (const name of ['公益團體', '捐款專案', '義賣商品']) {
      expect(screen.getByRole('tab', { name })).not.toBeDisabled()
    }
  })

  it('容器有 role="tablist"', () => {
    render(<TabsRow active="charity" onTabChange={() => {}} />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})
