export type FallbackKind = 'donation' | 'item'

/** Aspect / size hints aligned to each card's image slot:
 *   donation — 16:9 hero (DonationProjectCard `aspect-[16/9]`)
 *   item     — 1:1 product (SaleItemCard `aspect-square`) */
const DIMENSIONS: Record<FallbackKind, { w: number; h: number }> = {
  donation: { w: 640, h: 360 },
  item: { w: 400, h: 400 },
}

/**
 * Spec 003e4 §3.2 — fallback URL when a card's primary image fails to
 * load. Returns a Picsum Photos URL with the item id as the seed, so the
 * SAME id always resolves to the SAME picture (avoids SSR/CSR hydration
 * mismatch and list re-render flicker).
 *
 * Picsum URL contract: `https://picsum.photos/seed/<seed>/<w>/<h>` →
 * deterministic by seed, no API key. See https://picsum.photos.
 */
export function pickFallbackImage(kind: FallbackKind, id: string): string {
  const { w, h } = DIMENSIONS[kind]
  return `https://picsum.photos/seed/${kind}-${id}/${w}/${h}`
}
