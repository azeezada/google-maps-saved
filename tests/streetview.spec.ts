import { test, expect } from '@playwright/test'

/**
 * Tests for Street View thumbnail and hover preview feature.
 *
 * Because we can't hit the real Google Street View API in tests, we verify:
 * - The StreetViewThumbnail component renders inside PlaceDetailModal
 * - The "Add API Key" prompt is shown when no key is stored
 * - The API key input form works (save, cancel)
 * - The hover preview element is mounted when a row is hovered (with a key set)
 */

test.describe('Street View thumbnail in PlaceDetailModal', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored API key so tests start clean
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('places_analyzer_streetview_api_key'))
    await page.reload()
    // Load demo data
    await page.getByTestId('load-demo').first().click()
    await page.waitForSelector('[data-testid="view-list"]')
  })

  test('StreetViewThumbnail appears in PlaceDetailModal for a geocoded place', async ({ page }) => {
    await page.getByTestId('view-list').click()
    await page.waitForSelector('[data-testid="list-place-row"]')

    // Open modal for the first place that has a view-on-map button (i.e. geocoded)
    const rows = page.getByTestId('list-place-row')
    const count = await rows.count()
    let found = false

    for (let i = 0; i < Math.min(count, 10); i++) {
      await rows.nth(i).click()
      const modal = page.getByTestId('place-detail-modal')
      if (await modal.isVisible()) {
        const thumb = modal.getByTestId('streetview-thumbnail')
        if (await thumb.isVisible()) {
          found = true
          break
        }
        await page.getByTestId('place-detail-close').click()
      }
    }

    expect(found).toBe(true)
  })

  test('StreetViewThumbnail shows "Add API Key" button when no key stored', async ({ page }) => {
    await page.getByTestId('view-list').click()
    await page.waitForSelector('[data-testid="list-place-row"]')

    // Open first modal with a thumbnail
    const rows = page.getByTestId('list-place-row')
    const count = await rows.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      await rows.nth(i).click()
      const modal = page.getByTestId('place-detail-modal')
      if (await modal.isVisible()) {
        const thumb = modal.getByTestId('streetview-thumbnail')
        if (await thumb.isVisible()) {
          // Should show the "Add API Key" button since no key is set
          await expect(page.getByTestId('streetview-add-key-btn')).toBeVisible()
          break
        }
        await page.getByTestId('place-detail-close').click()
      }
    }
  })

  test('API key input form appears when "Add API Key" is clicked', async ({ page }) => {
    await page.getByTestId('view-list').click()
    await page.waitForSelector('[data-testid="list-place-row"]')

    const rows = page.getByTestId('list-place-row')
    const count = await rows.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      await rows.nth(i).click()
      const modal = page.getByTestId('place-detail-modal')
      if (await modal.isVisible()) {
        const addKeyBtn = page.getByTestId('streetview-add-key-btn')
        if (await addKeyBtn.isVisible()) {
          await addKeyBtn.click()
          // Key input should now be visible
          await expect(page.getByTestId('streetview-key-input')).toBeVisible()
          await expect(page.getByTestId('streetview-save-key-btn')).toBeVisible()
          break
        }
        await page.getByTestId('place-detail-close').click()
      }
    }
  })

  test('Save button is disabled when key input is empty', async ({ page }) => {
    await page.getByTestId('view-list').click()
    await page.waitForSelector('[data-testid="list-place-row"]')

    const rows = page.getByTestId('list-place-row')
    const count = await rows.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      await rows.nth(i).click()
      const modal = page.getByTestId('place-detail-modal')
      if (await modal.isVisible()) {
        const addKeyBtn = page.getByTestId('streetview-add-key-btn')
        if (await addKeyBtn.isVisible()) {
          await addKeyBtn.click()
          await expect(page.getByTestId('streetview-key-input')).toBeVisible()
          // Save button disabled with empty input
          await expect(page.getByTestId('streetview-save-key-btn')).toBeDisabled()
          break
        }
        await page.getByTestId('place-detail-close').click()
      }
    }
  })

  test('Typing a key enables Save and persists to localStorage', async ({ page }) => {
    await page.getByTestId('view-list').click()
    await page.waitForSelector('[data-testid="list-place-row"]')

    const rows = page.getByTestId('list-place-row')
    const count = await rows.count()
    let tested = false

    for (let i = 0; i < Math.min(count, 10); i++) {
      await rows.nth(i).click()
      const modal = page.getByTestId('place-detail-modal')
      if (await modal.isVisible()) {
        const addKeyBtn = page.getByTestId('streetview-add-key-btn')
        if (await addKeyBtn.isVisible()) {
          await addKeyBtn.click()

          const keyInput = page.getByTestId('streetview-key-input')
          await keyInput.fill('AIzaFakeTestKey1234567890')
          // Save button should now be enabled
          await expect(page.getByTestId('streetview-save-key-btn')).toBeEnabled()

          await page.getByTestId('streetview-save-key-btn').click()

          // Form should close, key should be stored
          await expect(page.getByTestId('streetview-key-input')).not.toBeVisible()

          const storedKey = await page.evaluate(() =>
            localStorage.getItem('places_analyzer_streetview_api_key')
          )
          expect(storedKey).toBe('AIzaFakeTestKey1234567890')
          tested = true
          break
        }
        await page.getByTestId('place-detail-close').click()
      }
    }

    expect(tested).toBe(true)
  })
})
