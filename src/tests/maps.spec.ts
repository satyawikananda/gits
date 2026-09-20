import { beforeEach, describe, expect, it } from 'vitest'
import {
  canonicalPlaceId,
  collectResults,
  extractBusiness,
  sameMapsPlace,
} from '../contentScripts/google-maps/extractor'

beforeEach(() => {
  document.body.innerHTML = ''
})
describe('maps extraction', () => {
  it('does not include query parameters in a final feature ID', () => {
    expect(canonicalPlaceId('https://www.google.com/maps/place/Spa/data=!1sspa-one?entry=ttu&hl=en')).toBe('spa-one')
  })
  it('prefers a feature ID over a search term stored in Maps data', () => {
    expect(canonicalPlaceId('https://www.google.com/maps/place/Spa/data=!1sspa%20Ubud!3m1!1s0x123:0x456!8m2')).toBe('0x123:0x456')
  })
  it('matches shared identifiers even when the card also has query_place_id', () => {
    expect(sameMapsPlace(
      'https://www.google.com/maps/place/Spa/data=!1s0x123:0x456?query_place_id=ChIJ-one',
      'https://www.google.com/maps/place/Spa/@-8,115,17z/data=!1s0x123:0x456!8m2',
    )).toBe(true)
  })
  it('ignores viewport changes for a place without stable IDs', () => {
    expect(sameMapsPlace(
      'https://www.google.com/maps/place/Spa/',
      'https://www.google.com/maps/place/Spa/@-8,115,17z/',
    )).toBe(true)
  })
  it('does not merge same-name businesses with conflicting IDs', () => {
    expect(sameMapsPlace(
      'https://www.google.com/maps/place/Spa/data=!1sspa-one',
      'https://www.google.com/maps/place/Spa/data=!1sspa-two',
    )).toBe(false)
    expect(sameMapsPlace('https://www.google.com/maps/search/Spa', 'https://www.google.com/maps/place/Spa')).toBe(false)
  })

  it('deduplicates stable feature IDs across URL variants', () => {
    document.body.innerHTML
      = '<div role="feed"><a aria-label="Coffee" href="https://www.google.com/maps/place/Coffee/data=!4m2!1splace-one!8m2?hl=en"></a><a aria-label="Coffee" href="https://www.google.com/maps/place/Coffee/data=!4m2!1splace-one!8m2?hl=id"></a></div>'
    expect(collectResults()).toHaveLength(1)
    expect(
      canonicalPlaceId(
        'https://www.google.com/maps/place/Coffee/data=!1splace-one!8m2',
      ),
    ).toBe('place-one')
  })
  it('extracts available details and leaves unknown fields missing', () => {
    document.body.innerHTML
      = '<div role="main"><h1>Coffee One</h1><button jsaction="pane.category">Coffee shop</button><button data-item-id="address" aria-label="Address: Denpasar"></button><span role="img" aria-label="4.7 stars"></span><button aria-label="1,234 reviews"></button><p>Open · Closes 9 PM</p></div>'
    const result = extractBusiness(
      {
        id: 'one',
        name: 'Coffee One',
        mapsUrl: 'https://www.google.com/maps/place/Coffee',
      },
      'Coffee Bali',
    )
    expect(result).toMatchObject({
      name: 'Coffee One',
      address: 'Denpasar',
      rating: 4.7,
      reviewCount: 1234,
      website: null,
      phone: null,
      businessStatus: 'active',
    })
    expect(result.location).toBeUndefined()
  })
  it('detects website and permanent closure without treating normal closed hours as permanent closure', () => {
    document.body.innerHTML
      = '<div role="main"><h1>Coffee</h1><a data-item-id="authority" href="https://coffee.example">Website</a><p>Permanently closed</p></div>'
    const ref = {
      id: 'one',
      name: 'Coffee',
      mapsUrl: 'https://www.google.com/maps/place/Coffee',
    }
    expect(extractBusiness(ref, '')).toMatchObject({
      website: 'https://coffee.example/',
      businessStatus: 'closed',
    })
    document.querySelector('p')!.textContent = 'Closed · Opens 9 AM'
    expect(extractBusiness(ref, '').businessStatus).toBe('active')
  })
  it('rejects missing details instead of inventing business data', () => {
    expect(() =>
      extractBusiness({ id: 'one', name: 'Coffee', mapsUrl: '' }, ''),
    ).toThrow()
  })
  it('reads the matching visible business panel instead of the search results or hidden details', () => {
    document.body.innerHTML = `
      <div role="main"><h1>Results</h1><div role="feed"><a data-item-id="authority" href="https://unrelated.example">Website</a></div></div>
      <div role="main" style="display:none"><h1>Spa One</h1><button data-item-id="address">Old address</button></div>
      <div role="main"><div role="heading" aria-level="1">Spa One</div><button data-item-id="address">Ubud</button> <p>Open</p></div>
    `
    expect(extractBusiness({ id: 'one', name: 'Spa One', mapsUrl: 'https://www.google.com/maps/place/Spa' }, 'spa Ubud')).toMatchObject({
      name: 'Spa One',
      address: 'Ubud',
      website: null,
      businessStatus: 'active',
    })
  })
})
