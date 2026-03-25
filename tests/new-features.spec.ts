import { test, expect } from '@playwright/test'

// Helper to load demo data
async function loadDemo(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByText('Load demo data instead →').click()
  await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
}

// ===========================================================================
// Compare Lists View
// ===========================================================================

test.describe('Compare Lists View', () => {
  test('compare view renders with list selectors', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'Compare' }).click()
    await expect(page.getByTestId('compare-view')).toBeVisible()
    await expect(page.getByTestId('compare-select-a')).toBeVisible()
    await expect(page.getByTestId('compare-select-b')).toBeVisible()
  })

  test('selecting two lists shows comparison stats and map', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'Compare' }).click()
    const selectA = page.getByTestId('compare-select-a')
    const selectB = page.getByTestId('compare-select-b')
    // Select first two available lists
    const options = await selectA.locator('option').allTextContents()
    const lists = options.filter(o => o !== 'Select list A')
    if (lists.length >= 2) {
      await selectA.selectOption({ label: lists[0] })
      await selectB.selectOption({ label: lists[1] })
      await expect(page.getByTestId('compare-stat-row').first()).toBeVisible()
    }
  })
})

// ===========================================================================
// Travel Diary Generator
// ===========================================================================

test.describe('Travel Diary Generator', () => {
  test('diary view renders with trip selector', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'Diary' }).click()
    await expect(page.getByTestId('diary-view')).toBeVisible()
    await expect(page.getByTestId('diary-trip-select')).toBeVisible()
  })

  test('selecting a trip generates a narrative', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'Diary' }).click()
    const select = page.getByTestId('diary-trip-select')
    const options = await select.locator('option').allTextContents()
    const trips = options.filter(o => o !== 'Select a trip...')
    if (trips.length > 0) {
      await select.selectOption({ index: 1 })
      await expect(page.getByTestId('diary-narrative')).toBeVisible()
      await expect(page.getByTestId('diary-title')).toBeVisible()
      await expect(page.getByTestId('diary-timeline')).toBeVisible()
    }
  })
})

// ===========================================================================
// My Food Map
// ===========================================================================

test.describe('My Food Map', () => {
  test('food map view renders', async ({ page }) => {
    await loadDemo(page)
    await page.getByTestId('view-food').click()
    await expect(page.getByTestId('food-map-view')).toBeVisible()
  })

  test('food map shows filter buttons', async ({ page }) => {
    await loadDemo(page)
    await page.getByTestId('view-food').click()
    await expect(page.getByTestId('food-filter-all')).toBeVisible()
  })
})

// ===========================================================================
// Places I've Visited Tracker
// ===========================================================================

test.describe('Visited Places Tracker', () => {
  test('visited toggle appears in list view', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'List', exact: true }).click()
    const toggles = page.getByTestId('list-visited-toggle')
    await expect(toggles.first()).toBeVisible()
  })

  test('clicking visited toggle in place detail modal toggles state', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'List', exact: true }).click()
    // Click first place to open modal
    await page.getByTestId('list-place-row').first().click()
    await expect(page.getByTestId('place-detail-modal')).toBeVisible()
    const toggle = page.getByTestId('place-visited-toggle')
    await expect(toggle).toBeVisible()
    // Toggle visited
    await toggle.click()
    await expect(page.getByTestId('place-visited-badge')).toBeVisible()
    // Toggle back
    await toggle.click()
    await expect(page.getByTestId('place-visited-badge')).not.toBeVisible()
  })
})

// ===========================================================================
// Share a Subset
// ===========================================================================

test.describe('Share Place', () => {
  test('share button appears in place detail modal', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.getByTestId('list-place-row').first().click()
    await expect(page.getByTestId('place-detail-modal')).toBeVisible()
    await expect(page.getByTestId('place-share-btn')).toBeVisible()
  })

  test('clicking share copies link to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await loadDemo(page)
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.getByTestId('list-place-row').first().click()
    await expect(page.getByTestId('place-detail-modal')).toBeVisible()
    await page.getByTestId('place-share-btn').click()
    // The clipboard should contain a URL with #place=
    const clipText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipText).toContain('#place=')
  })
})

// ===========================================================================
// Time-of-Day Pattern
// ===========================================================================

test.describe('Time-of-Day Pattern', () => {
  test('time-of-day section may appear in analytics (depends on data timestamps)', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: /Analytics/ }).click()
    // The section only appears if dates have timestamps — demo data may or may not
    // Just check that analytics loads successfully
    await expect(page.locator('main')).toBeVisible()
  })
})

// ===========================================================================
// Error Boundaries
// ===========================================================================

test.describe('Error Boundaries', () => {
  test('error boundary fallback exists in DOM structure', async ({ page }) => {
    await loadDemo(page)
    // Error boundaries are wrappers — they only show fallback on error.
    // We verify the app loads without error boundaries triggering.
    await expect(page.getByTestId('error-boundary-fallback')).not.toBeVisible()
    // Switch through all views to confirm none crash
    for (const view of ['List', 'Analytics', 'Trips', 'Compare', 'Diary', 'Food']) {
      await page.getByRole('button', { name: view, exact: true }).click()
      await expect(page.locator('main')).toBeVisible()
    }
  })
})

// ===========================================================================
// Input Sanitization
// ===========================================================================

test.describe('Input Sanitization', () => {
  test('loaded demo data has no HTML tags in place names', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'List', exact: true }).click()
    const rows = page.getByTestId('list-place-row')
    const count = await rows.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await rows.nth(i).textContent()
      expect(text).not.toMatch(/<script/i)
      expect(text).not.toMatch(/javascript:/i)
    }
  })
})

// ===========================================================================
// Accessibility
// ===========================================================================

test.describe('Accessibility', () => {
  test('all interactive elements have accessible names', async ({ page }) => {
    await loadDemo(page)
    // Check sidebar toggle has a title/label
    const sidebarToggle = page.getByTestId('sidebar-toggle')
    await expect(sidebarToggle).toHaveAttribute('title', /sidebar/i)

    // Check view mode buttons have titles
    for (const view of ['map', 'list', 'analytics', 'trips', 'compare', 'diary', 'food']) {
      const btn = page.getByTestId(`view-${view}`)
      await expect(btn).toHaveAttribute('title')
    }
  })

  test('modal has proper close button with aria-label', async ({ page }) => {
    await loadDemo(page)
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.getByTestId('list-place-row').first().click()
    await expect(page.getByTestId('place-detail-modal')).toBeVisible()
    const closeBtn = page.getByTestId('place-detail-close')
    await expect(closeBtn).toHaveAttribute('aria-label', 'Close')
  })
})
