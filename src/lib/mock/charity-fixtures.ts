import type { Charity } from '@/lib/schemas/list'

/**
 * Spec 002 §4 — charity tab mock fixtures
 * 對齊 IMG_4880 截圖（ACC / ASGL 等小 logo + name + tagline 風格）。
 */
export const CHARITY_FIXTURES: Charity[] = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    name: 'ACC 中華耆幼關懷協會',
    description: '你身上有光，能照亮不確定的黑暗。',
    categories: ['child_care', 'elderly_care'],
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    name: 'ASGL 台灣霧後光聯盟',
    description: '陰天從不代表藍天不見了 — 冬天也不會永遠停留。',
    categories: ['poverty_relief', 'media'],
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    name: '社團法人台灣動物保護協會',
    description: '為毛孩發聲，讓每隻流浪動物都有安身之所。',
    categories: ['animal_protection'],
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    name: '財團法人中華身心障礙者藝術發展協會',
    description: '藝術不問身體，只問心。',
    categories: ['disability_service', 'arts_culture'],
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    name: '社團法人台灣婦女關懷協會',
    description: '當妳被照顧，世界才會被照亮。',
    categories: ['women_care'],
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    name: '財團法人台灣國際救援基金會',
    description: '愛沒有國界，希望也沒有。',
    categories: ['international_aid', 'poverty_relief'],
  },
  {
    id: '11111111-1111-4111-8111-000000000007',
    name: '社團法人台灣特殊醫病關懷協會',
    description: '罕病不是絕望，是我們攜手前進的理由。',
    categories: ['special_medical'],
  },
  {
    id: '11111111-1111-4111-8111-000000000008',
    name: '財團法人運動公益發展基金會',
    description: '讓每個孩子都能在運動中找到自己。',
    categories: ['sports_development', 'education_advocacy'],
  },
]
