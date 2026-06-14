import type { Donation } from '@/lib/schemas/list'

/**
 * Spec 002 §4 — donation tab mock fixtures
 * 對齊 IMG_4875 截圖（cover image + 主辦團體 overlay + categories chips）。
 */
export const DONATION_FIXTURES: Donation[] = [
  {
    id: '22222222-2222-4222-8222-000000000001',
    name: '【安居．專業．愛】── 守護身障弱勢，共築安全專業家園勸募活動',
    description: '為 60 位心智障礙者打造永久的家，給他們一個真正的「家庭」。',
    charityId: '11111111-1111-4111-8111-000000000004',
    charityName: '財團法人宜蘭縣私立柏拉圖復康之家',
    coverImageUrl: 'https://picsum.photos/seed/donation01/640/360',
    categories: ['disability_service', 'poverty_relief'],
  },
  {
    id: '22222222-2222-4222-8222-000000000002',
    name: '和我們一起重新思考，你我能為台灣做的事',
    description: '從垃圾分類到永續飲食，每個選擇都在為下一代蓄電。',
    charityId: '11111111-1111-4111-8111-000000000002',
    charityName: '社團法人台灣重新思考環境教育協會',
    coverImageUrl: 'https://picsum.photos/seed/donation02/640/360',
    categories: ['environmental_protection'],
  },
  {
    id: '22222222-2222-4222-8222-000000000003',
    name: '她沒有放手 ── 偏鄉孩童課後守護計畫',
    description: '一杯熱湯、一句晚安，讓沒有家的孩子也能安心入睡。',
    charityId: '11111111-1111-4111-8111-000000000001',
    charityName: 'ACC 中華耆幼關懷協會',
    coverImageUrl: 'https://picsum.photos/seed/donation03/640/360',
    categories: ['child_care', 'poverty_relief', 'education_advocacy'],
  },
  {
    id: '22222222-2222-4222-8222-000000000004',
    name: '為流浪毛孩搭一座暖暖窩',
    description: '中途之家擴建，目標年底前為 200 隻毛孩找到家。',
    charityId: '11111111-1111-4111-8111-000000000003',
    charityName: '社團法人台灣動物保護協會',
    coverImageUrl: 'https://picsum.photos/seed/donation04/640/360',
    categories: ['animal_protection'],
  },
  {
    id: '22222222-2222-4222-8222-000000000005',
    name: '罕病兒童藥物援助 ── 不讓家庭獨自承擔',
    description: '每月新台幣 30 萬元的藥費，是這些家庭一輩子的拉鋸。',
    charityId: '11111111-1111-4111-8111-000000000007',
    charityName: '社團法人台灣特殊醫病關懷協會',
    coverImageUrl: 'https://picsum.photos/seed/donation05/640/360',
    categories: ['special_medical', 'child_care', 'disability_service', 'poverty_relief'],
  },
  {
    id: '22222222-2222-4222-8222-000000000006',
    name: '婦女庇護中心緊急援助',
    description: '24 小時匿名熱線 + 安全居所，讓妳能安心走出第一步。',
    charityId: '11111111-1111-4111-8111-000000000005',
    charityName: '社團法人台灣婦女關懷協會',
    categories: ['women_care'],
  },
  {
    id: '22222222-2222-4222-8222-000000000007',
    name: '土耳其大地震災後重建募款',
    description: '搶救生命之後，是長達數年的重建。我們會待到最後。',
    charityId: '11111111-1111-4111-8111-000000000006',
    charityName: '財團法人台灣國際救援基金會',
    coverImageUrl: 'https://picsum.photos/seed/donation07/640/360',
    categories: ['international_aid'],
  },
  {
    id: '22222222-2222-4222-8222-000000000008',
    name: '部落孩子運動夢 ── 體育獎學金計畫',
    description: '讓山裡的孩子也有專業教練、像樣的球鞋、走出去的機會。',
    charityId: '11111111-1111-4111-8111-000000000008',
    charityName: '財團法人運動公益發展基金會',
    coverImageUrl: 'https://picsum.photos/seed/donation08/640/360',
    categories: ['sports_development', 'education_advocacy', 'child_care'],
  },
]
