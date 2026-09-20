import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleMapsExecutor } from '../contentScripts/google-maps/executor'
import { canonicalPlaceId } from '../contentScripts/google-maps/extractor'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('location', new URL('https://www.google.com/maps?hl=en'))
  document.body.innerHTML = ''
})

describe('opening business details', () => {
  const cardUrl = 'https://www.google.com/maps/place/Spa+One/data=!1s0x123:0x456?entry=ttu&query_place_id=ChIJ-one'
  const detailUrl = 'https://www.google.com/maps/place/Spa+One/@-8,115,17z/data=!1s0x123:0x456!8m2?entry=ttu'
  const candidate = { id: canonicalPlaceId(cardUrl), name: 'Spa One', mapsUrl: cardUrl }

  it('opens and reads the requested business across card and detail URL variants', async () => {
    document.body.innerHTML = `<div role="main"><h1>Results</h1><div role="feed"><a href="${cardUrl}">Spa One</a></div></div>`
    const link = document.querySelector('a')!
    const click = vi.fn((event: Event) => {
      event.preventDefault()
      vi.stubGlobal('location', new URL(detailUrl))
      document.body.insertAdjacentHTML('beforeend', '<div role="main"><div role="heading" aria-level="1">Spa One</div><button data-item-id="address">Ubud</button></div>')
    })
    link.addEventListener('click', click)
    const executor = new GoogleMapsExecutor(new AbortController().signal)
    const work = executor.openBusiness(candidate)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(work).resolves.toBeUndefined()
    await expect(executor.readBusiness(candidate, 'spa Ubud, Bali')).resolves.toMatchObject({ id: candidate.id, name: 'Spa One', address: 'Ubud' })
    expect(click).toHaveBeenCalledOnce()
  })

  it('waits for the requested title even when its URL changes before the panel', async () => {
    document.body.innerHTML = `<a href="${cardUrl}">Spa One</a><div role="main"><h1>Previous Spa</h1></div>`
    document.querySelector('a')!.addEventListener('click', (event) => {
      event.preventDefault()
      vi.stubGlobal('location', new URL(detailUrl))
    })
    const completed = vi.fn()
    const work = (async () => {
      await new GoogleMapsExecutor(new AbortController().signal).openBusiness(candidate)
      completed()
    })()
    await vi.advanceTimersByTimeAsync(2000)
    expect(completed).not.toHaveBeenCalled()
    document.querySelector('h1')!.textContent = 'Spa One'
    await vi.advanceTimersByTimeAsync(1500)
    await work
    expect(completed).toHaveBeenCalledOnce()
  })

  it('does not read another same-name business with a different feature ID', async () => {
    vi.stubGlobal('location', new URL('https://www.google.com/maps/place/Spa+One/data=!1s0x123:0x999'))
    document.body.innerHTML = '<div role="main"><h1>Spa One</h1></div>'
    await expect(new GoogleMapsExecutor(new AbortController().signal).readBusiness(candidate, 'spa Ubud')).rejects.toMatchObject({ code: 'maps_extraction' })
  })

  it('rejects navigation away while waiting for the business title', async () => {
    vi.stubGlobal('location', new URL(detailUrl))
    const result = expect(new GoogleMapsExecutor(new AbortController().signal).readBusiness(candidate, 'spa Ubud')).rejects.toMatchObject({ code: 'maps_extraction' })
    await vi.advanceTimersByTimeAsync(500)
    vi.stubGlobal('location', new URL('https://www.google.com/maps/place/Spa+One/data=!1sother-spa'))
    document.body.innerHTML = '<div role="main"><h1>Spa One</h1></div>'
    await vi.advanceTimersByTimeAsync(200)
    await result
  })

  it('honors pause while waiting for the business details', async () => {
    document.body.innerHTML = `<a href="${cardUrl}">Spa One</a>`
    document.querySelector('a')!.addEventListener('click', event => event.preventDefault())
    const controller = new AbortController()
    const result = expect(new GoogleMapsExecutor(controller.signal).openBusiness(candidate)).rejects.toMatchObject({ code: 'interrupted' })
    await vi.advanceTimersByTimeAsync(500)
    controller.abort()
    await vi.advanceTimersByTimeAsync(200)
    await result
  })

  it('explains when the selected URL matches but its title is missing', async () => {
    document.body.innerHTML = `<a href="${cardUrl}">Spa One</a>`
    document.querySelector('a')!.addEventListener('click', (event) => {
      event.preventDefault()
      vi.stubGlobal('location', new URL(detailUrl))
    })
    const result = expect(new GoogleMapsExecutor(new AbortController().signal).openBusiness(candidate)).rejects.toMatchObject({
      code: 'maps_selectors',
      message: expect.stringContaining('The URL matches "Spa One", but its visible business title is missing.'),
    })
    await vi.advanceTimersByTimeAsync(20000)
    await result
  })

  it('explains whether the URL or title failed to match after clicking', async () => {
    document.body.innerHTML = `<a href="${cardUrl}">Spa One</a>`
    document.querySelector('a')!.addEventListener('click', event => event.preventDefault())
    const result = expect(new GoogleMapsExecutor(new AbortController().signal).openBusiness(candidate)).rejects.toMatchObject({
      code: 'maps_selectors',
      message: expect.stringContaining('The active Maps URL does not match "Spa One"'),
    })
    await vi.advanceTimersByTimeAsync(20000)
    await result
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function showResults() {
  const feed = document.querySelector('[role="feed"]') ?? document.createElement('div')
  feed.setAttribute('role', 'feed')
  feed.innerHTML = '<a aria-label="Spa One" href="https://www.google.com/maps/place/Spa/data=!1sspa-one">Spa One</a>'
  document.body.append(feed)
}

describe('maps DOM readiness', () => {
  it.each([
    '<button aria-label="Search"></button>',
    '<button aria-label="Search Google Maps"></button>',
    '<button aria-label="Telusuri"></button>',
    '<button aria-label="Cari"></button>',
    '<button jsaction="click:searchbox.search"></button>',
  ])('searches without the legacy button ID: %s', async (button) => {
    document.body.innerHTML = `<input name="q">${button}`
    const click = vi.fn(showResults)
    document.querySelector('button')!.addEventListener('click', click)
    const work = new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')
    await vi.advanceTimersByTimeAsync(1500)
    await expect(work).resolves.toMatchObject([{ id: 'spa-one' }])
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('input')?.value).toBe('Spa Bali')
  })

  it('fills the input before waiting for a button enabled by the query', async () => {
    document.body.innerHTML = '<input id="searchboxinput"><button id="searchbox-searchbutton" disabled></button>'
    const button = document.querySelector('button')!
    document.querySelector('input')!.addEventListener('input', () => {
      button.disabled = false
    })
    button.addEventListener('click', showResults)
    const work = new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')
    await vi.advanceTimersByTimeAsync(1500)
    await expect(work).resolves.toMatchObject([{ id: 'spa-one' }])
  })

  it('uses Enter when Maps has no matching search button', async () => {
    document.body.innerHTML = '<input role="combobox" aria-controls="suggestions"><button aria-label="Directions"></button>'
    const input = document.querySelector('input')!
    const unrelatedClick = vi.fn()
    document.querySelector('button')!.addEventListener('click', unrelatedClick)
    const enter = vi.fn((event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.keyCode === 13) {
        event.preventDefault()
        expect(document.activeElement).toBe(input)
        expect(input.value).toBe('Spa Bali')
        showResults()
      }
    })
    input.addEventListener('keydown', enter)
    const keypress = vi.fn()
    input.addEventListener('keypress', keypress)
    const work = new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')
    await vi.advanceTimersByTimeAsync(2500)
    await expect(work).resolves.toMatchObject([{ id: 'spa-one' }])
    expect(enter).toHaveBeenCalledOnce()
    expect(keypress).not.toHaveBeenCalled()
    expect(unrelatedClick).not.toHaveBeenCalled()
  })

  it('waits for businesses when the result feed mounts empty', async () => {
    document.body.innerHTML = '<input name="q"><button aria-label="Search"></button>'
    document.querySelector('button')!.addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', '<div role="feed"></div>')
    })
    const completed = vi.fn()
    const work = (async () => {
      const results = await new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')
      completed()
      return results
    })()
    await vi.advanceTimersByTimeAsync(2000)
    expect(completed).not.toHaveBeenCalled()
    showResults()
    await vi.advanceTimersByTimeAsync(200)
    await expect(work).resolves.toMatchObject([{ id: 'spa-one' }])
  })

  it('reports a results timeout if Maps ignores Enter', async () => {
    document.body.innerHTML = '<input name="q">'
    const result = expect(new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')).rejects.toMatchObject({
      code: 'maps_selectors',
      message: expect.stringContaining('search results'),
    })
    await vi.advanceTimersByTimeAsync(23000)
    await result
  })

  it('does not reuse the previous query results when Maps ignores Enter', async () => {
    document.body.innerHTML = '<input name="q" value="Coffee Bali">'
    showResults()
    const result = expect(new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')).rejects.toMatchObject({
      code: 'maps_selectors',
      message: expect.stringContaining('search results'),
    })
    await vi.advanceTimersByTimeAsync(23000)
    await result
  })

  it('waits for the previous results to be replaced after changing the query', async () => {
    document.body.innerHTML = '<input name="q" value="Coffee Bali">'
    showResults()
    const completed = vi.fn()
    const work = (async () => {
      const results = await new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')
      completed()
      return results
    })()
    await vi.advanceTimersByTimeAsync(2500)
    expect(completed).not.toHaveBeenCalled()
    document.querySelector('[role="feed"]')!.innerHTML = '<a aria-label="Spa Two" href="https://www.google.com/maps/place/Spa/data=!1sspa-two">Spa Two</a>'
    await vi.advanceTimersByTimeAsync(200)
    await expect(work).resolves.toMatchObject([{ id: 'spa-two' }])
  })

  it('accepts an explicit empty search result', async () => {
    document.body.innerHTML = '<input name="q"><button aria-label="Search"></button>'
    document.querySelector('button')!.addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', '<div role="main">No results found</div>')
    })
    const work = new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')
    await vi.advanceTimersByTimeAsync(1500)
    await expect(work).resolves.toEqual([])
  })

  it('accepts a search that opens one business directly', async () => {
    document.body.innerHTML = '<input name="q"><button aria-label="Search"></button>'
    document.querySelector('button')!.addEventListener('click', () => {
      vi.stubGlobal('location', new URL('https://www.google.com/maps/place/Spa/data=!1sspa-one'))
      document.body.insertAdjacentHTML('beforeend', '<div role="main"><h1>Spa One</h1></div>')
    })
    const work = new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')
    await vi.advanceTimersByTimeAsync(1500)
    await expect(work).resolves.toMatchObject([{ id: 'spa-one', name: 'Spa One' }])
  })

  it('honors pause before the Enter fallback', async () => {
    document.body.innerHTML = '<input name="q">'
    const enter = vi.fn()
    document.querySelector('input')!.addEventListener('keydown', enter)
    const controller = new AbortController()
    const result = expect(new GoogleMapsExecutor(controller.signal).search('Spa Bali')).rejects.toMatchObject({ code: 'interrupted' })
    await vi.advanceTimersByTimeAsync(500)
    controller.abort()
    await vi.advanceTimersByTimeAsync(500)
    await result
    expect(enter).not.toHaveBeenCalled()
  })

  it.each([
    ['<form action="https://consent.google.com/save"></form>', 'maps_consent'],
    ['<div class="g-recaptcha"></div>', 'maps_blocked'],
  ])('preserves the manual intervention guard for %s', async (markup, code) => {
    document.body.innerHTML = `<input name="q">${markup}`
    await expect(new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')).rejects.toMatchObject({ code })
  })

  it('waits for a search button that mounts after the input', async () => {
    document.body.innerHTML = '<input id="searchboxinput">'
    const work = new GoogleMapsExecutor(new AbortController().signal).search('Spa Denpasar, Bali')
    await vi.advanceTimersByTimeAsync(500)
    const button = document.createElement('button')
    button.id = 'searchbox-searchbutton'
    button.addEventListener('click', () => {
      const feed = document.createElement('div')
      feed.setAttribute('role', 'feed')
      feed.innerHTML = '<a aria-label="Spa One" href="https://www.google.com/maps/place/Spa/data=!1sspa-one">Spa One</a>'
      document.body.append(feed)
    })
    document.body.append(button)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(work).resolves.toMatchObject([{ id: 'spa-one', name: 'Spa One' }])
    expect(document.querySelector('input')?.value).toBe('Spa Denpasar, Bali')
  })

  it('reports which control timed out instead of a generic research error', async () => {
    const result = expect(new GoogleMapsExecutor(new AbortController().signal).search('Spa Bali')).rejects.toMatchObject({
      code: 'maps_selectors',
      message: expect.stringContaining('the search input'),
    })
    await vi.advanceTimersByTimeAsync(20000)
    await result
  })

  it('reads a business without requiring its optional category', async () => {
    const mapsUrl = 'https://www.google.com/maps/place/Spa/data=!1sspa-one'
    vi.stubGlobal('location', new URL(mapsUrl))
    document.body.innerHTML = '<div role="main"><h1>Spa One</h1><button data-item-id="address">Denpasar</button></div>'
    await expect(new GoogleMapsExecutor(new AbortController().signal).readBusiness({
      id: 'spa-one',
      name: 'Spa One',
      mapsUrl,
    }, 'Spa Bali')).resolves.toMatchObject({ name: 'Spa One', category: undefined, address: 'Denpasar' })
  })
})
