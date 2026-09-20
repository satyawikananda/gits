import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SearchForm from '../popup/components/SearchForm.vue'
import JevSettings from '../popup/components/JevSettings.vue'
import LeadResults from '../popup/components/LeadResults.vue'
import ResearchProgress from '../popup/components/ResearchProgress.vue'
import { createSession, defaultConfig } from '../shared/search'
import type { Command, SearchConfig } from '../shared/types'

const settings = {
  engine: 'mock' as const,
  theme: 'light' as const,
  decisionLimit: 25,
}
describe('vue product controls', () => {
  it('shows the persisted failure and its step when reopening research progress', () => {
    const session = createSession({ ...defaultConfig, niche: 'Spa', location: 'Denpasar, Bali' })
    session.status = 'error'
    session.errorCode = 'maps_connection'
    session.message = 'Reload the Google Maps tab, then resume.'
    const wrapper = mount(ResearchProgress, { props: { session, busy: false } })
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain(session.message)
    expect(alert.text()).toContain('Code: maps_connection')
    expect(alert.text()).toContain('Step: searching')
    wrapper.unmount()
  })
  it('submits a typed search brief with configurable rating, target and keyword list', async () => {
    const wrapper = mount(SearchForm, { props: { settings, busy: false } })
    await wrapper.get('input[placeholder="Coffee shop"]').setValue('Coffee')
    await wrapper.get('input[placeholder="Denpasar, Bali"]').setValue('Bali')
    await wrapper
      .get('input[placeholder="cafe, specialty coffee"]')
      .setValue('cafe, specialty, ')
    await wrapper.findAll('input[type="checkbox"]')[2].setValue(true)
    await wrapper.get('input[aria-label="Minimum rating"]').setValue(4.5)
    await wrapper.get('input[aria-describedby="target-hint"]').setValue(10)
    await wrapper.get('form').trigger('submit')
    const config = wrapper.emitted('start')![0][0] as SearchConfig
    expect(config).toMatchObject({
      niche: 'Coffee',
      location: 'Bali',
      targetLeadCount: 10,
      keywords: ['cafe', 'specialty'],
      engine: 'mock',
      decisionLimit: 25,
      filters: { minimumRating: 4.5, withoutWebsite: true },
    })
    wrapper.unmount()
  })
  it('clears a submitted key from the input and exposes connection test and removal controls', async () => {
    const wrapper = mount(JevSettings, {
      props: {
        settings,
        connection: { hasKey: true, connected: true },
        busy: false,
        running: false,
      },
    })
    expect(wrapper.text()).toContain('Test Connection')
    await wrapper.get('input[type="password"]').setValue('synthetic-ui-key')
    await wrapper.findAll('form')[0].trigger('submit')
    expect(wrapper.emitted('command')![0][0] as Command).toEqual({
      type: 'connect',
      key: 'synthetic-ui-key',
    })
    expect(
      (wrapper.get('input[type="password"]').element as HTMLInputElement).value,
    ).toBe('')
    await wrapper.findAll('button').find(button => button.text() === 'Remove key')!.trigger('click')
    expect(wrapper.emitted('command')![1][0]).toEqual({ type: 'remove-key' })
    wrapper.unmount()
  })
  it('requires confirmation before replacing results and displays saved decision evidence', async () => {
    const session = createSession({
      ...defaultConfig,
      niche: 'Coffee',
      location: 'Bali',
    })
    session.status = 'completed'
    session.leads = [
      {
        id: 'one',
        name: 'Coffee',
        category: 'Cafe',
        sourceQuery: 'Coffee Bali',
        decision: {
          qualified: true,
          relevant: true,
          priority: 'high',
          reason: 'Useful prospecting evidence',
          action: 'save',
        },
        collectedAt: 0,
      },
    ]
    const wrapper = mount(LeadResults, { props: { session, busy: false } })
    expect(wrapper.text()).toContain('Useful prospecting evidence')
    await wrapper
      .findAll('button')
      .find(button => button.text().includes('New Search'))!
      .trigger('click')
    expect(wrapper.emitted('newSearch')).toBeUndefined()
    expect(wrapper.text()).toContain('replaces these local results')
    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Start new search')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.emitted('newSearch')).toHaveLength(1)
    wrapper.unmount()
  })
})
