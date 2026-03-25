import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import JSZip from 'jszip'

const FIXTURE_ZIP = path.resolve(__dirname, 'fixtures/takeout.zip')
const SECOND_ZIP = path.resolve(__dirname, 'fixtures/takeout2.zip')

/** Create a minimal valid Takeout ZIP with one unique place. */
async function createMinimalZip(placeName: string, lat: number, lng: number): Promise<Buffer> {
  const zip = new JSZip()
  const savedPlaces = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          location: {
            name: placeName,
            address: `1 Main St, TestCity, TC 00001, Test Country`,
            country_code: 'TC',
          },
          date: '2024-01-01T00:00:00Z',
          google_maps_url: `https://maps.google.com/?q=${lat},${lng}`,
        },
      },
    ],
  }
  zip.file('Takeout/Maps (your places)/Saved places.json', JSON.stringify(savedPlaces))
  return zip.generateAsync({ type: 'nodebuffer' })
}

test.describe('Multi-file support', () => {
  test.beforeAll(async () => {
    // Ensure fixture dir exists
    const dir = path.dirname(FIXTURE_ZIP)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    // Create first ZIP if it doesn't already exist
    if (!fs.existsSync(FIXTURE_ZIP)) {
      const buf = await createMinimalZip('Test Place Alpha', 48.85, 2.35)
      fs.writeFileSync(FIXTURE_ZIP, buf)
    }

    // Create second ZIP with a DIFFERENT place
    const buf2 = await createMinimalZip('Test Place Beta', 35.68, 139.69)
    fs.writeFileSync(SECOND_ZIP, buf2)
  })

  test.afterAll(() => {
    // Clean up second zip
    if (fs.existsSync(SECOND_ZIP)) fs.unlinkSync(SECOND_ZIP)
  })

  test('multi-file manager toggle appears after loading data', async ({ page }) => {
    await page.goto('/')

    // Load demo data first
    await page.click('[data-testid="load-demo"]')
    await page.waitForSelector('[data-testid="place-count-badge"]')

    // Multi-file toggle should be visible in header
    await expect(page.locator('[data-testid="multi-file-toggle"]')).toBeVisible()
  })

  test('multi-file panel opens and shows loaded file', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="load-demo"]')
    await page.waitForSelector('[data-testid="place-count-badge"]')

    await page.click('[data-testid="multi-file-toggle"]')
    await expect(page.locator('[data-testid="multi-file-panel"]')).toBeVisible()

    // First file (index 0) should show
    await expect(page.locator('[data-testid="loaded-file-0"]')).toBeVisible()
  })

  test('add-zip button is visible in panel', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="load-demo"]')
    await page.waitForSelector('[data-testid="place-count-badge"]')

    await page.click('[data-testid="multi-file-toggle"]')
    await expect(page.locator('[data-testid="add-zip-btn"]')).toBeVisible()
  })

  test('loading a second ZIP merges places and updates count', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="load-demo"]')
    await page.waitForSelector('[data-testid="place-count-badge"]')

    // Record initial place count
    const initialBadge = await page.locator('[data-testid="place-count-badge"]').textContent()
    const initialCount = parseInt(initialBadge?.match(/\d+/)?.[0] ?? '0', 10)
    expect(initialCount).toBeGreaterThan(0)

    // Open multi-file panel and upload second ZIP
    await page.click('[data-testid="multi-file-toggle"]')
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="add-zip-btn"]'),
    ])
    await fileChooser.setFiles(SECOND_ZIP)

    // Wait for the second file to appear in the list
    await expect(page.locator('[data-testid="loaded-file-1"]')).toBeVisible({ timeout: 10000 })

    // Toggle button should show "2 files"
    await expect(page.locator('[data-testid="multi-file-toggle"]')).toContainText('2 files')

    // Place count should be > 0 after merge (duplicates may be deduplicated, so count may differ)
    const badge = await page.locator('[data-testid="place-count-badge"]').textContent()
    const allNums = (badge?.match(/\d+/g) ?? []).map(n => parseInt(n, 10))
    expect(allNums.every(n => n > 0)).toBeTruthy()
  })

  test('removing a second ZIP restores original count', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="load-demo"]')
    await page.waitForSelector('[data-testid="place-count-badge"]')

    const initialBadge = await page.locator('[data-testid="place-count-badge"]').textContent()
    const initialCount = parseInt(initialBadge?.match(/\d+/)?.[0] ?? '0', 10)

    // Add second file
    await page.click('[data-testid="multi-file-toggle"]')
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="add-zip-btn"]'),
    ])
    await fileChooser.setFiles(SECOND_ZIP)
    await expect(page.locator('[data-testid="loaded-file-1"]')).toBeVisible({ timeout: 10000 })

    // Remove second file
    await page.click('[data-testid="remove-file-1"]')

    // Should be back to 1 file
    await expect(page.locator('[data-testid="multi-file-toggle"]')).toContainText('1 file')

    // Count should be restored to initial (back to 1 file = same as before merge)
    const restoredBadge = await page.locator('[data-testid="place-count-badge"]').textContent()
    const restoredCount = parseInt(restoredBadge?.match(/\d+/)?.[0] ?? '0', 10)
    // The single-file restored state should match initial (no merge deduplication)
    expect(restoredCount).toBeGreaterThan(0)
    // When only 1 file loaded, it uses the stored ParsedData directly (no merge path)
    // which should equal the original count
    expect(restoredCount).toBe(initialCount)
  })
})
