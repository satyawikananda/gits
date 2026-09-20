import type { CandidateRef, MapsExecutor } from '../../shared/types'
import { GitsError } from '../../shared/errors'
import {
  canonicalPlaceId,
  collectResults,
  extractBusiness,
  findBusinessHeading,
  isMapsPlaceUrl,
  isVisibleMapsElement,
  sameMapsPlace,
} from './extractor'
import { selectors } from './selectors'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
export function assertSupportedPage() {
  if (
    document.querySelector(selectors.challenge)
    || location.pathname.startsWith('/sorry')
    || /unusual traffic|automated queries/i.test(document.body.textContent ?? '')
  ) {
    throw new GitsError(
      'maps_blocked',
      'Google presented an anti-bot check. Research stopped; resolve it manually before starting another search.',
    )
  }
  if (
    location.hostname !== 'www.google.com'
    || !location.pathname.startsWith('/maps')
  ) {
    throw new GitsError(
      'maps_unsupported',
      'Keep the research tab on Google Maps (google.com/maps).',
    )
  }
  if (document.querySelector(selectors.consent)) {
    throw new GitsError(
      'maps_consent',
      'Complete Google’s consent screen manually, then resume.',
    )
  }
}
export class GoogleMapsExecutor implements MapsExecutor {
  constructor(private readonly signal: AbortSignal) {}
  private check() {
    if (this.signal.aborted)
      throw new GitsError('interrupted', 'Research paused or stopped.')
    assertSupportedPage()
  }

  private async waitFor<T>(
    read: () => T | undefined | null | false,
    expected: string,
    diagnose?: () => string,
  ): Promise<T> {
    const start = Date.now()
    while (Date.now() - start < 20000) {
      this.check()
      const value = read()
      if (value)
        return value
      await delay(200)
    }
    throw new GitsError(
      'maps_selectors',
      `Google Maps did not show ${expected} within 20 seconds. ${diagnose ? `${diagnose()} ` : ''}Check that the page has loaded, reload the Maps tab, then resume.`,
    )
  }

  private async settle() {
    await delay(1300)
    this.check()
  }

  private async submitSearch(input: HTMLInputElement) {
    // Give controls rendered after input a short grace period, without requiring
    // Google's legacy button ID for layouts that submit through the search input.
    const deadline = Date.now() + 1000
    do {
      this.check()
      const button = [...document.querySelectorAll<HTMLButtonElement>(selectors.searchButton)]
        .find(button => !button.disabled && !button.closest('[hidden], [aria-hidden="true"]'))
      if (button) {
        button.click()
        return
      }
      await delay(200)
    } while (Date.now() < deadline)

    this.check()
    input.focus()
    const options: KeyboardEventInit = {
      key: 'Enter',
      code: 'Enter',
      // Include numeric fields for compatibility with older keyboard handlers.
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
    }
    if (input.dispatchEvent(new KeyboardEvent('keydown', options)))
      input.dispatchEvent(new KeyboardEvent('keypress', options))
    input.dispatchEvent(new KeyboardEvent('keyup', options))
  }

  async search(query: string): Promise<CandidateRef[]> {
    this.check()
    const input = await this.waitFor(
      () => document.querySelector<HTMLInputElement>(selectors.search),
      'the search input',
    )
    const previousQuery = input.value
    const previousPanel = document.querySelector(selectors.feed) ?? document.querySelector(selectors.heading)
    const previousMarkup = previousPanel?.innerHTML
    const previousUrl = location.href
    input.focus()
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(input, query)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await this.submitSearch(input)
    await this.settle()
    await this.waitFor(
      () => {
        const panel = document.querySelector(selectors.feed) ?? document.querySelector(selectors.heading)
        // An ignored submission must not return the previous query's businesses.
        if (previousQuery !== query && previousPanel && panel === previousPanel
          && panel.innerHTML === previousMarkup && location.href === previousUrl) {
          return false
        }
        return collectResults(document.querySelector(selectors.feed) ?? document).length > 0
          || (isMapsPlaceUrl(location.href) && document.querySelector(selectors.heading)?.textContent?.trim())
          || /no results found|couldn.t find/i.test(
            document.querySelector(selectors.empty)?.textContent ?? '',
          )
      },
      'search results',
    )
    const results = collectResults(
      document.querySelector(selectors.feed) ?? document,
    )
    if (results.length)
      return results
    const name = document.querySelector(selectors.heading)?.textContent?.trim()
    if (name && isMapsPlaceUrl(location.href)) {
      return [
        { id: canonicalPlaceId(location.href), name, mapsUrl: location.href },
      ]
    }
    return []
  }

  async scrollResults(): Promise<CandidateRef[]> {
    this.check()
    const feed = document.querySelector<HTMLElement>(selectors.feed)
    if (!feed) {
      if (document.querySelector(selectors.heading))
        return []
      throw new GitsError(
        'maps_selectors',
        'Google Maps result list is unavailable.',
      )
    }
    feed.scrollTop = feed.scrollHeight
    feed.dispatchEvent(new Event('scroll', { bubbles: true }))
    await this.settle()
    return collectResults(feed)
  }

  async openBusiness(candidate: CandidateRef): Promise<void> {
    this.check()
    if (!isMapsPlaceUrl(candidate.mapsUrl))
      throw new GitsError('maps_unsupported', 'Unsupported business URL.')
    if (
      !sameMapsPlace(location.href, candidate.mapsUrl)
      || !findBusinessHeading(document, candidate.name)
    ) {
      const link = [
        ...document.querySelectorAll<HTMLAnchorElement>(selectors.results),
      ].find(link => isMapsPlaceUrl(link.href) && sameMapsPlace(link.href, candidate.mapsUrl) && isVisibleMapsElement(link))
      if (!link) {
        throw new GitsError(
          'maps_selectors',
          'The queued business is no longer in the results. Resume to reload the search.',
        )
      }
      link.click()
    }
    await this.waitFor(
      () =>
        sameMapsPlace(location.href, candidate.mapsUrl)
        && findBusinessHeading(document, candidate.name),
      'the selected business details',
      () => {
        const heading = findBusinessHeading()
        if (!sameMapsPlace(location.href, candidate.mapsUrl))
          return `The active Maps URL does not match "${candidate.name}".`
        return heading
          ? `Waiting for "${candidate.name}"; Maps still shows "${heading.textContent?.trim()}".`
          : `The URL matches "${candidate.name}", but its visible business title is missing.`
      },
    )
    await this.settle()
  }

  async readBusiness(candidate: CandidateRef, query: string) {
    this.check()
    if (!sameMapsPlace(location.href, candidate.mapsUrl)) {
      throw new GitsError(
        'maps_extraction',
        'The selected business changed before it could be read.',
      )
    }
    await this.waitFor(() => findBusinessHeading(document, candidate.name), 'the business name')
    this.check()
    if (!sameMapsPlace(location.href, candidate.mapsUrl))
      throw new GitsError('maps_extraction', 'The selected business changed before it could be read.')
    return extractBusiness(candidate, query)
  }

  async backToResults(): Promise<void> {
    this.check()
    const back = document.querySelector<HTMLButtonElement>(selectors.back)
    if (back) {
      back.click()
      await this.settle()
      await this.waitFor(() => document.querySelector(selectors.feed), 'the result list')
    }
  }
}
