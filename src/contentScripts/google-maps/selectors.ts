// Google Maps does not publish a stable DOM API. Keep all DOM assumptions here.
// v0.1 opens Maps with hl=en; data-item-id anchors are preferred to translated copy.
export const selectors = {
  search: 'input#searchboxinput, input[name="q"], input[role="combobox"][aria-controls]',
  searchButton: [
    'button#searchbox-searchbutton',
    'button[jsaction*="searchbox.search"]',
    'button[aria-label="Search"]',
    'button[aria-label="Search Google Maps"]',
    'button[aria-label="Telusuri"]',
    'button[aria-label="Cari"]',
  ].join(', '),
  feed: '[role="feed"]',
  results: 'a[href*="/maps/place/"]',
  main: '[role="main"]',
  heading: 'h1.DUwDvf, [role="main"] h1',
  businessHeading: 'h1, [role="heading"][aria-level="1"]',
  category: 'button[jsaction*="category"]',
  address: '[data-item-id="address"]',
  phone: '[data-item-id^="phone:tel:"]',
  website: 'a[data-item-id="authority"]',
  rating:
    'span[role="img"][aria-label*="star"], span[role="img"][aria-label*="bintang"]',
  reviews: 'button[aria-label*="reviews"], button[aria-label*="ulasan"]',
  description: '[data-attrid="kc:/location/location:description"]',
  back: 'button[aria-label="Back"], button[aria-label="Back to results"]',
  challenge:
    '#captcha-form, .g-recaptcha, iframe[src*="recaptcha"], form[action*="/sorry/"]',
  consent: 'form[action*="consent.google"], button[aria-label="Accept all"]',
  empty: '[role="main"]',
}
