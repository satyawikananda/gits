import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 10000 },
  retries: 0,
  workers: 1,
  use: { headless: true },
})
