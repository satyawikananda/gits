import path from 'node:path'
import process from 'node:process'
import { type BrowserContext, test as base, chromium } from '@playwright/test'

export const extensionPath = path.join(__dirname, '../extension')
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({ headless }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      headless,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    const background
      = context.serviceWorkers()[0]
        ?? (await context.waitForEvent('serviceworker'))
    await use(background.url().split('/')[2])
  },
})
export const expect = test.expect
