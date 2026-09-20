import browser from 'webextension-polyfill'
import type { Command, Reply, Snapshot } from '../../shared/types'
import { leadsToCsv } from '../../shared/csv'

export function useResearch() {
  const data = ref<Snapshot>({
    session: null,
    settings: { engine: 'jev', decisionLimit: 100, theme: 'system' },
    connection: { hasKey: false, connected: false },
  })
  const busy = ref(false)
  const ready = ref(false)
  const error = ref('')

  async function request(command: Command): Promise<boolean> {
    busy.value = true
    error.value = ''
    try {
      const reply: Reply<Snapshot> = await browser.runtime.sendMessage({
        channel: 'gits-ui',
        command,
      })
      if (!reply?.ok) {
        error.value = reply?.error ?? 'The extension did not respond.'
        return false
      }
      data.value = reply.data
      return true
    }
    catch {
      error.value
        = 'The extension background is unavailable. Reload the extension and try again.'
      return false
    }
    finally {
      busy.value = false
      ready.value = true
    }
  }
  const listener: Parameters<
    typeof browser.storage.onChanged.addListener
  >[0] = (changes, area) => {
    if (area !== 'local')
      return
    if (changes['gits.session.v1']) {
      data.value.session
        = (changes['gits.session.v1'].newValue as Snapshot['session']) ?? null
    }

    if (changes['gits.settings.v1']) {
      data.value.settings = changes['gits.settings.v1']
        .newValue as Snapshot['settings']
    }

    if (changes['gits.connection']) {
      data.value.connection = changes['gits.connection']
        .newValue as Snapshot['connection']
    }
  }

  onMounted(() => {
    browser.storage.onChanged.addListener(listener)
    void request({ type: 'snapshot' })
  })

  onUnmounted(() => browser.storage.onChanged.removeListener(listener))
  function exportCsv() {
    const session = data.value.session
    if (!session)
      return
    const url = URL.createObjectURL(
      new Blob([leadsToCsv(session.leads)], {
        type: 'text/csv;charset=utf-8;',
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `gits-${session.id.slice(0, 8)}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const memoizeSession = computed(() => data.value.session)

  return {
    data,
    busy,
    ready,
    error,
    session: memoizeSession,
    request,
    exportCsv,
  }
}
