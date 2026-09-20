import type { CandidateRef, LeadCandidate } from '../../shared/types'
import { GitsError } from '../../shared/errors'
import { selectors } from './selectors'

function placeIdentity(href: string) {
  const url = new URL(href)
  const placeId = url.searchParams.get('query_place_id')
  // Parse only Maps data, not tracking parameters or the viewport coordinates.
  const data
    = url.pathname.split('/data=')[1] ?? url.searchParams.get('data') ?? ''
  const fields = [...data.matchAll(/!1s([^!]+)/g)].map((match) => {
    try {
      return decodeURIComponent(match[1])
    }
    catch {
      return match[1]
    }
  })
  const feature
    = fields.find(value => /^0x[\da-f]+:0x[\da-f]+$/i.test(value)) ?? fields[0]
  const cid = url.searchParams.get('cid')
  const path = url.pathname.match(/^\/maps\/place\/[^/]+/)?.[0] ?? url.pathname
  return { placeId, feature, cid, path }
}

export function canonicalPlaceId(href: string): string {
  const { placeId, feature, cid, path } = placeIdentity(href)
  return placeId ?? feature ?? cid ?? path
}

export function sameMapsPlace(left: string, right: string): boolean {
  const a = placeIdentity(left)
  const b = placeIdentity(right)
  for (const key of ['placeId', 'feature', 'cid'] as const) {
    if (a[key] && b[key])
      return a[key] === b[key]
  }
  const aIds = [a.placeId, a.feature, a.cid].filter(Boolean)
  const bIds = [b.placeId, b.feature, b.cid].filter(Boolean)
  if (aIds.length && bIds.length)
    return aIds.some(id => bIds.includes(id))
  // Without comparable IDs, a place URL and its business title are both checked
  // by the executor. Never identify a business from a search URL alone.
  return isMapsPlaceUrl(left) && isMapsPlaceUrl(right) && a.path === b.path
}

export function isVisibleMapsElement(element: Element): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]'))
    return false
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const style = getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden')
      return false
  }
  return true
}

export function findBusinessHeading(
  root: ParentNode = document,
  name?: string,
): HTMLElement | undefined {
  const normalize = (value: string) =>
    value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
  return [
    ...root.querySelectorAll<HTMLElement>(selectors.businessHeading),
  ].find(
    heading =>
      !heading.closest(selectors.feed)
      && isVisibleMapsElement(heading)
      && Boolean(heading.textContent?.trim())
      && (name === undefined
        || normalize(heading.textContent ?? '') === normalize(name)),
  )
}

export function isMapsPlaceUrl(href: string): boolean {
  try {
    const url = new URL(href)
    return (
      url.protocol === 'https:'
      && url.hostname === 'www.google.com'
      && url.pathname.startsWith('/maps/place/')
    )
  }
  catch {
    return false
  }
}

export function collectResults(root: ParentNode = document): CandidateRef[] {
  const entries = new Map<string, CandidateRef>()
  for (const link of root.querySelectorAll<HTMLAnchorElement>(
    selectors.results,
  )) {
    if (!isMapsPlaceUrl(link.href))
      continue
    const id = canonicalPlaceId(link.href)
    const name
      = link.getAttribute('aria-label')?.trim() || link.textContent?.trim() || ''
    if (name)
      entries.set(id, { id, name, mapsUrl: link.href })
  }
  return [...entries.values()]
}

function text(root: ParentNode, selector: string): string | undefined {
  return root.querySelector(selector)?.textContent?.trim() || undefined
}

function labelled(root: ParentNode, selector: string): string | undefined {
  const element = root.querySelector(selector)
  return (
    element
      ?.getAttribute('aria-label')
      ?.replace(/^(Address|Phone):\s*/i, '')
      .trim()
      || element?.textContent?.trim()
      || undefined
  )
}

export function extractBusiness(
  ref: CandidateRef,
  query: string,
  root: ParentNode = document,
): LeadCandidate {
  const heading = findBusinessHeading(root, ref.name)
  const name = heading?.textContent?.trim()
  if (!name) {
    throw new GitsError(
      'maps_extraction',
      'The business details could not be read. Google Maps selectors may have changed.',
    )
  }
  root = heading!.closest('[role="main"], [role="dialog"]') ?? root
  const body = (root as Element).textContent ?? ''
  const ratingText
    = root.querySelector(selectors.rating)?.getAttribute('aria-label') ?? ''
  const ratingValue = Number(
    ratingText.match(/\d[.,]\d/)?.[0]?.replace(',', '.'),
  )
  const reviewsLabel
    = root.querySelector(selectors.reviews)?.getAttribute('aria-label') ?? ''
  const reviewDigits = reviewsLabel.match(/[\d,.\s]+/)?.[0]?.replace(/\D/g, '')
  const websiteElement = root.querySelector<HTMLAnchorElement>(
    selectors.website,
  )
  const websiteUrl = websiteElement?.href
  const website
    = websiteUrl && /^https?:\/\//i.test(websiteUrl) ? websiteUrl : null
  const closed
    = /permanently closed|temporarily closed|tutup permanen|tutup sementara/i.test(
      body,
    )
  const active = /\bopen\b|\bopens\b|\bcloses\b|\bbuka\b/i.test(body)
  return {
    id: ref.id,
    name,
    category: text(root, selectors.category),
    address: labelled(root, selectors.address),
    rating:
      Number.isFinite(ratingValue) && ratingValue >= 0 && ratingValue <= 5
        ? ratingValue
        : undefined,
    reviewCount: reviewDigits ? Number(reviewDigits) : undefined,
    website,
    phone: labelled(root, selectors.phone) ?? null,
    mapsUrl: ref.mapsUrl,
    description: text(root, selectors.description),
    businessStatus: closed ? 'closed' : active ? 'active' : 'unknown',
    sourceQuery: query,
  }
}
