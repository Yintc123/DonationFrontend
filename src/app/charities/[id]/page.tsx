import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { TopNav } from '@/components/ui/TopNav'
import { fetchCharityDetail } from '@/lib/api/getDetail'
import { NotFoundError } from '@/lib/errors/NotFoundError'
import type { CharityDetail } from '@/lib/schemas/detail'
import { getCharityInitial } from '@/components/ui/charity-initial'

type PageProps = { params: Promise<{ id: string }> }

async function safeFetch(id: string): Promise<CharityDetail | null> {
  try {
    return await fetchCharityDetail(id)
  } catch (e) {
    if (e instanceof NotFoundError) return null
    throw e
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const c = await safeFetch(id)
  return {
    title: c ? `${c.name} | JKODonation` : '公益團體介紹 | JKODonation',
  }
}

/**
 * Spec 004a — 公益團體介紹頁
 *
 * RSC fetches backend via `fetchCharityDetail` (spec 004 §3 — "RSC fetch
 * backend"). 404 from upstream → `notFound()` → Next 404 page.
 *
 * Detail-only fields (contactPhone / contactEmail / officialWebsite /
 * approvalNo) all render conditionally; backend optional values arrive as
 * undefined here (mapper drops nulls).
 */
export default async function Page({ params }: PageProps) {
  const { id } = await params
  const charity = await safeFetch(id)
  if (!charity) notFound()

  return (
    <div className="flex flex-col min-h-dvh bg-surface-page">
      <TopNav title="公益團體介紹" />
      <Hero name={charity.name} logoUrl={charity.logoUrl} />
      <div className="-mt-6 mx-3 bg-surface-card rounded-2xl shadow-sm relative z-10 p-5 space-y-5">
        <ContactInfo
          contactPhone={charity.contactPhone}
          contactEmail={charity.contactEmail}
          officialWebsite={charity.officialWebsite}
          approvalNo={charity.approvalNo}
        />
        <Description text={charity.description} />
        {charity.categories.length > 0 && (
          <CategoryTags categories={charity.categories} />
        )}
      </div>
      <div className="flex-1 px-5 py-6">
        <RelatedSection charityId={charity.id} />
      </div>
      <DirectDonateCta />
    </div>
  )
}

function Hero({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <section className="bg-brand pb-10 pt-8 px-5 flex flex-col items-center gap-4">
      <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            width={96}
            height={96}
            className="w-full h-full object-cover"
          />
        ) : (
          <span aria-hidden className="text-brand text-3xl font-bold select-none">
            {getCharityInitial(name)}
          </span>
        )}
      </div>
      <h1 className="text-white text-lg font-bold text-center leading-7">
        {name}
      </h1>
    </section>
  )
}

function ContactInfo({
  contactPhone,
  contactEmail,
  officialWebsite,
  approvalNo,
}: {
  contactPhone?: string
  contactEmail?: string
  officialWebsite?: string
  approvalNo?: string
}) {
  // Suppress the whole section if backend returned nothing — avoids
  // an empty "基本資料" header above zero rows.
  if (!contactPhone && !contactEmail && !officialWebsite && !approvalNo) {
    return null
  }
  return (
    <section aria-labelledby="contact-info-h">
      <h2 id="contact-info-h" className="text-base font-medium text-ink-AAA mb-3">
        基本資料
      </h2>
      <dl className="grid grid-cols-[6em_1fr] gap-y-2 text-sm">
        {contactPhone && (
          <>
            <dt className="text-ink-AA">聯絡電話</dt>
            <dd>
              <a className="text-ink-link" href={`tel:${contactPhone}`}>
                {contactPhone}
              </a>
            </dd>
          </>
        )}
        {contactEmail && (
          <>
            <dt className="text-ink-AA">聯絡信箱</dt>
            <dd>
              <a className="text-ink-link" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            </dd>
          </>
        )}
        {officialWebsite && (
          <>
            <dt className="text-ink-AA">官方網站</dt>
            <dd>
              <a
                className="text-ink-link break-all"
                href={officialWebsite}
                target="_blank"
                rel="noreferrer noopener"
              >
                {officialWebsite}
              </a>
            </dd>
          </>
        )}
        {approvalNo && (
          <>
            <dt className="text-ink-AA">核准字號</dt>
            <dd className="text-ink-AAA">{approvalNo}</dd>
          </>
        )}
      </dl>
    </section>
  )
}

function Description({ text }: { text: string }) {
  return (
    <section>
      <p className="text-sm leading-6 text-ink-AAA">{text}</p>
    </section>
  )
}

function CategoryTags({
  categories,
}: {
  categories: { id: string; displayName: string }[]
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <li
          key={c.id}
          className="inline-flex items-center px-3 py-1 rounded-full
                     bg-black/5 text-xs leading-5 text-ink-AA"
        >
          {c.displayName}
        </li>
      ))}
    </ul>
  )
}

function RelatedSection({ charityId }: { charityId: string }) {
  return (
    <section>
      <h2 className="text-base font-medium text-ink-AAA mb-3">捐款專案</h2>
      <p className="text-sm text-ink-A">
        看此團體的進行中專案,或瀏覽全部捐款項目。
      </p>
      <Link
        href={`/donation?tab=donation&charityId=${charityId}`}
        className="inline-block mt-2 text-sm text-ink-link"
      >
        看此團體的捐款專案 →
      </Link>
    </section>
  )
}

function DirectDonateCta() {
  return (
    <div className="sticky bottom-0 inset-x-0 bg-surface-card border-t border-line px-5 py-3 pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        className="w-full h-12 rounded-full bg-brand text-white text-base font-semibold
                   focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        直接捐款給團體
      </button>
    </div>
  )
}
