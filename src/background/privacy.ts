import browser from 'webextension-polyfill'

export async function restrictLocalStorage(): Promise<void> {
  const local = browser.storage.local as typeof browser.storage.local & {
    setAccessLevel?: (options: {
      accessLevel: 'TRUSTED_CONTEXTS'
    }) => Promise<void>
  }
  await local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' })
}
