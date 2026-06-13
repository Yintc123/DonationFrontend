# Spec 004a：公益團體介紹頁

- **狀態**：Draft（v0.1）
- **路由**：`/charities/:id`
- **路徑**：`src/app/charities/[id]/page.tsx` + `src/components/features/CharityDetail.tsx`
- **依賴**：[004 index](./004-detail-pages.md)、[003e1 CharityCard](./003e1-charity-card.md)（cross-link 區重用）
- **Figma 對應**：IMG_4876
- **Backend endpoint**：`GET /v1/donation/charities/:id`（spec 017）

---

## 1. 職責

呈現單一公益團體的完整資料 + 該團體底下捐款專案的 cross-link 清單。

---

## 2. Anatomy（對齊 IMG_4876）

```
┌─ TopNav: ← 公益團體介紹  [分享 icon] ───┐  紅底
├─ 紅底 hero：                           │  紅底延伸
│   - logo（白底圓形大）                 │
│   - 團體名稱（白字置中）               │
├─ 白色 panel（rounded-2xl，覆蓋 hero 底）┐
│   ┌─ 基本資料                          │
│   │   - 聯絡電話：02-66040024           │  → tel: link
│   │   - 聯絡信箱：serv.accofroc@...     │  → mailto:
│   │   - 官方網站：https://accofroc.org  │  → 外連 target=_blank
│   │   - 核准字號：台內團字第111...號     │
│   └─ 簡介（line-clamp-3 + 「...更多」展開）
│   └─ Categories tag pills（兒少照護、弱勢扶貧、身心障礙服務）
├─ Sticky CTA bar（紅底全寬）            │
│   ┌─「直接捐款給團體」                  │  UI only
└────────────────────────────────────────┘
│ 標題「捐款專案」                       │  cross-link 區
│ horizontal scroll of 捐款專案 cards    │  reuse <DonationProjectCard>
└────────────────────────────────────────┘
```

---

## 3. 資料流

```tsx
// src/app/charities/[id]/page.tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await fetchCharityDetail(id) // BFF → backend
  if (!data) notFound()
  return <CharityDetail charity={data} />
}
```

`fetchCharityDetail` 回傳 `CharityDetail`（[004 §5](./004-detail-pages.md)）。

子表 cross-link 區（IMG_4876 下半部「捐款專案」）：

- 另呼 `GET /v1/donation/donation-projects?charityId=<id>&limit=10`（已有 endpoint，spec 016 v0.5）
- 或 backend 在 detail response 加 `recentProjects: [...]` embed（屬 additive，spec 017 留開放問題）
- v0.1 先用獨立呼叫，並行 fetch（`Promise.all` 在 RSC）

---

## 4. 元件結構

| 區塊 | 元件 | 備註 |
|---|---|---|
| TopNav | [003b TopNav](./003b-topnav.md) | 標題「公益團體介紹」，accessory = 分享 icon（UI only） |
| Hero | `<CharityHero logo name />` | inline 或新元件 |
| 基本資料 | `<ContactInfoList />` | server component 純展示，tel/mailto/外連 |
| 簡介 + 更多 | `<ExpandableText text />` | `'use client'`：collapsed/expanded state |
| Categories tags | `<CategoryTags categories />` | tag pills |
| Sticky CTA | `<StickyCta label="直接捐款給團體" />` | `fixed inset-x-0 bottom-0 z-40` |
| Cross-link 區 | `<RelatedProjects charityId />` | RSC fetch + map `<DonationProjectCard>` |

---

## 5. 邊界

- 任一聯絡欄位 optional：缺 → 該行不渲染
- 簡介 ≤ 100 字 → 不顯示「...更多」按鈕
- categories 為空陣列 → 不渲染 tag 區
- cross-link 區為 0 筆 → 該區整段不渲染（無「沒有專案」空狀態）

---

## 6. 測試

- Server fetch 404 → 顯示 `not-found.tsx`
- 缺 contactEmail → 該行不出現
- 簡介短於門檻 → 「...更多」不出現
- 「更多」點開 → 顯示完整簡介
- 點 tel/mailto/website 連結 → 對應 protocol
- CTA 按鈕只觸 `console.log` / toast（不導向）
- cross-link 區呼叫 `/api/donation-projects?charityId=:id`
