import { test, expect } from '@playwright/test'

/**
 * Trip Detection — Playwright smoke tests
 *
 * The demo data (public/data/saved-places.json) has dated entries,
 * so at least some trips should be detected.  We test:
 *  1. The "Trips" nav button is visible after loading data.
 *  2. Switching to Trips view shows the stats bar and either trip cards
 *     or a clear empty-state message.
 *  3. Clicking a trip card opens the detail pane with a trip map and
 *     place rows.
 *  4. Clicking a place row opens the Place Detail Modal.
 */

async function loadDemoData(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByText('Load demo data instead →').click()
  await expect(page.getByTestId('place-count-badge')).toBeVisible({ timeout: 10_000 })
}

test.describe('Trip detection', () => {
  test('Trips button is visible in the nav after loading data', async ({ page }) => {
    await loadDemoData(page)
    const tripsBtn = page.getByRole('button', { name: /trips/i })
    await expect(tripsBtn).toBeVisible()
  })

  test('Switching to Trips view renders the stats bar', async ({ page }) => {
    await loadDemoData(page)
    await page.getByRole('button', { name: /trips/i }).click()
    // Stats bar always shows "trips detected" or a warning
    await expect(
      page.getByText(/trips? detected|no trips detected|no dates found/i).first(),
    ).toBeVisible({ timeout: 8_000 })
  })

  test('Trip cards appear or empty state is shown', async ({ page }) => {
    await loadDemoData(page)
    await page.getByRole('button', { name: /trips/i }).click()

    const tripCard = page.getByTestId('trip-card').first()
    const emptyState = page.getByText(/no trips detected/i)

    // One of the two must be visible
    await expect(tripCard.or(emptyState)).toBeVisible({ timeout: 8_000 })
  })

  test('Clicking a trip card shows place rows', async ({ page }) => {
    await loadDemoData(page)
    await page.getByRole('button', { name: /trips/i }).click()

    const tripCard = page.getByTestId('trip-card').first()
    const count = await tripCard.count()
    if (count === 0) {
      // Demo data has no trips — skip gracefully
      test.skip()
      return
    }

    await tripCard.click()

    // Should show at least one place row
    await expect(page.getByTestId('trip-place-row').first()).toBeVisible({
      timeout: 8_000,
    })
  })

  test('Clicking a trip place row opens the Place Detail Modal', async ({ page }) => {
    await loadDemoData(page)
    await page.getByRole('button', { name: /trips/i }).click()

    const tripCard = page.getByTestId('trip-card').first()
    if ((await tripCard.count()) === 0) {
      test.skip()
      return
    }

    await tripCard.click()

    const placeRow = page.getByTestId('trip-place-row').first()
    await expect(placeRow).toBeVisible({ timeout: 8_000 })
    await placeRow.click()

    // Modal should appear
    await expect(page.getByTestId('place-detail-modal')).toBeVisible({ timeout: 5_000 })
  })
})
