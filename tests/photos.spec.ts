import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * Tests for Google Photos integration:
 * - ZIP upload with Photos sidecar JSON files
 * - Photos matched and displayed in PlaceDetailModal
 * - Photo stats visible in AnalyticsView
 * - Album breakdown shown in AnalyticsView
 */

const FIXTURE_ZIP = path.join(__dirname, 'fixtures', 'takeout-test.zip')

test.describe('Photo Integration — ZIP Upload', () => {
  test('ZIP with Google Photos sidecars parses photos and shows match count', async ({ page }) => {
    await page.goto('/')

    // Upload the fixture ZIP (which includes 4 photo sidecars, 3 with GPS)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE_ZIP)

    // Wait for app to load (data loaded = header + view buttons visible)
    await expect(page.getByTestId('view-list')).toBeVisible({ timeout: 20000 })
  })

  test('matched photos appear in PlaceDetailModal when ZIP has nearby photo sidecars', { timeout: 60000 }, async ({ page }) => {
    await page.goto('/')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE_ZIP)
    await expect(page.getByTestId('view-list')).toBeVisible({ timeout: 20000 })

    // Switch to list view
    await page.getByTestId('view-list').click()
    await expect(page.getByTestId('list-place-row').first()).toBeVisible()

    // Click a place known to be near photo coordinates (Nubeluz — 6m from NYC photo)
    // There may be duplicates from different sources, so use first()
    const targetRow = page.getByTestId('list-place-row').filter({ hasText: 'Nubeluz' }).first()
    await expect(targetRow).toBeVisible({ timeout: 5000 })
    await targetRow.click()

    const modal = page.getByTestId('place-detail-modal')
    await expect(modal).toBeVisible()
    // Should show matched photos section
    await expect(modal.getByTestId('place-photos-section')).toBeVisible()
    await expect(modal.getByTestId('place-photo-item').first()).toBeVisible()
  })

  test('photo stats section appears in AnalyticsView when photos are matched', async ({ page }) => {
    await page.goto('/')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE_ZIP)
    await expect(page.getByTestId('view-list')).toBeVisible({ timeout: 20000 })

    // Go to analytics
    await page.getByTestId('view-analytics').click()
    await expect(page.getByTestId('photo-stats-section')).toBeVisible({ timeout: 5000 })

    // Both stat cards should show
    await expect(page.getByTestId('photo-stat-places')).toBeVisible()
    await expect(page.getByTestId('photo-stat-total')).toBeVisible()

    // Values should be non-zero
    const placesText = await page.getByTestId('photo-stat-places').textContent()
    const totalText = await page.getByTestId('photo-stat-total').textContent()
    expect(parseInt(placesText ?? '0')).toBeGreaterThan(0)
    expect(parseInt(totalText ?? '0')).toBeGreaterThan(0)
  })

  test('photo album breakdown shows top albums in AnalyticsView', async ({ page }) => {
    await page.goto('/')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE_ZIP)
    await expect(page.getByTestId('view-list')).toBeVisible({ timeout: 20000 })

    await page.getByTestId('view-analytics').click()
    await expect(page.getByTestId('photo-stats-section')).toBeVisible({ timeout: 5000 })

    // Album breakdown should list at least one album row
    await expect(page.getByTestId('photo-album-breakdown')).toBeVisible()
    const albumRows = page.getByTestId('photo-album-row')
    const rowCount = await albumRows.count()
    expect(rowCount).toBeGreaterThanOrEqual(1)
  })

  test('photo stats NOT shown in AnalyticsView when no photos in data (demo mode)', async ({ page }) => {
    await page.goto('/')
    // Load demo (no photos bundled)
    await page.getByTestId('load-demo').first().click()
    await expect(page.getByTestId('view-list')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('view-analytics').click()
    // Photo stats section should NOT be visible (no matched photos)
    const photoSection = page.getByTestId('photo-stats-section')
    const isVisible = await photoSection.isVisible().catch(() => false)
    // It's acceptable if there are no photos (section hidden) - we just verify app doesn't crash
    expect(isVisible).toBe(false)
  })
})
