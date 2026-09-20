import { Buffer } from 'node:buffer'
import { expect, test } from './fixtures'
import { mapsFixture } from './maps-fixture'

test('first use, mock search, pause, reopen, resume, review, export and theme', async ({
  context,
  page,
  extensionId,
}) => {
  await context.route('https://www.google.com/**', route =>
    route.fulfill({ contentType: 'text/html', body: mapsFixture }))
  let paidCalls = 0
  await context.route('https://api.typesafe.ai/**', async (route) => {
    paidCalls++
    await route.abort()
  })
  const popupUrl = `chrome-extension://${extensionId}/dist/popup/index.html`
  await page.goto(popupUrl)
  await expect(
    page.getByRole('heading', { name: 'Connect Jev' }),
  ).toBeVisible()
  await page.getByLabel('Decision engine').selectOption('mock')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(
    page.getByRole('button', { name: 'Start Research' }),
  ).toBeVisible()
  await page.getByLabel('What are you looking for?').fill('Coffee')
  await page.getByLabel('Location', { exact: true }).fill('Bali')
  await page.getByLabel('Target', { exact: true }).fill('2')
  await page.screenshot({ path: 'test-results/gits-form.png', fullPage: true })
  await page.getByRole('button', { name: 'Start Research' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto(popupUrl)
  await expect(reopened.getByRole('button', { name: 'Resume' })).toBeVisible()
  await reopened.getByRole('button', { name: 'Resume' }).click()
  await expect(
    reopened.getByRole('heading', { name: 'Search complete' }),
  ).toBeVisible({ timeout: 70000 })
  await expect(
    reopened.getByText('2 qualified leads · found from 3 businesses'),
  ).toBeVisible()
  await expect(
    reopened.getByRole('link', { name: 'Coffee Two' }),
  ).toBeVisible()
  await expect(
    reopened.getByRole('link', { name: 'Coffee With Website' }),
  ).toHaveCount(0)
  await reopened.screenshot({
    path: 'test-results/gits-results.png',
    fullPage: true,
  })
  const downloadPromise = reopened.waitForEvent('download')
  await reopened.getByRole('button', { name: 'Export CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^gits-.*\.csv$/)
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  const csv = Buffer.concat(chunks).toString('utf8')
  expect(csv).toContain('Coffee Two')
  expect(csv).not.toContain('Coffee With Website')
  expect(csv).toContain('qualification_reason')
  expect(paidCalls).toBe(0)
  await reopened.getByRole('button', { name: 'Settings', exact: true }).click()
  await reopened.getByLabel('Appearance').selectOption('dark')
  await reopened.getByRole('button', { name: 'Save settings' }).click()
  await expect(reopened.locator('html')).toHaveClass('dark')
  await reopened.screenshot({
    path: 'test-results/gits-dark.png',
    fullPage: true,
  })
  await reopened.getByRole('button', { name: 'New Search' }).click()
  await reopened
    .getByRole('button', { name: 'Start new search', exact: true })
    .click()
  await expect(
    reopened.getByRole('button', { name: 'Start Research' }),
  ).toBeVisible()
})

test('stop on a CAPTCHA fixture and preserve the stopped session after reopen', async ({
  context,
  page,
  extensionId,
}) => {
  await context.route('https://www.google.com/**', route =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body><form id="captcha-form">Unusual traffic</form></body></html>',
    }))
  const popupUrl = `chrome-extension://${extensionId}/dist/popup/index.html`
  await page.goto(popupUrl)
  await page.getByLabel('Decision engine').selectOption('mock')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await page.getByLabel('What are you looking for?').fill('Coffee')
  await page.getByLabel('Location', { exact: true }).fill('Bali')
  await page.getByRole('button', { name: 'Start Research' }).click()
  await expect(
    page.getByRole('heading', { name: 'Research stopped' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Google presented an anti-bot check/),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Research stopped' }),
  ).toBeVisible()
})
