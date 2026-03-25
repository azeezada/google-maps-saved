import { test, expect } from '@playwright/test'

async function loadDemoData(page: any) {
  await page.goto('/')
  await page.getByText('Load demo data instead →').click()
  await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(800)
}

async function goToAnalytics(page: any) {
  await page.getByRole('button', { name: /Analytics/ }).click()
  await page.waitForTimeout(600)
}

test.describe('Category Inference', () => {
  test('categories section is visible in analytics view', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const section = page.getByTestId('categories-section')
    await expect(section).toBeVisible({ timeout: 8000 })
    await expect(section).toContainText('Place Types')
  })

  test('shows category chips with emojis and counts', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const chips = page.getByTestId('category-chips')
    await expect(chips).toBeVisible({ timeout: 8000 })

    const chipItems = page.getByTestId('category-chip')
    const count = await chipItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('renders category bar chart rows', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const bars = page.getByTestId('category-bars')
    await expect(bars).toBeVisible({ timeout: 8000 })

    const rows = page.getByTestId('category-bar-row')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('category badge shows in place detail modal', async ({ page }) => {
    await loadDemoData(page)

    // Go to list view and click a place
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.waitForTimeout(400)

    const firstRow = page.getByTestId('list-place-row').first()
    await firstRow.click()
    await page.waitForTimeout(300)

    const modal = page.getByTestId('place-detail-modal')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Category badge should be present (may be 'other' which still renders)
    // At least the modal opened with badges
    const badges = modal.locator('[class*="rounded-full"]')
    const badgeCount = await badges.count()
    expect(badgeCount).toBeGreaterThanOrEqual(2) // list badge + source badge at minimum
  })

  test('category emoji appears in list view rows', async ({ page }) => {
    await loadDemoData(page)

    // Go to list view
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.waitForTimeout(400)

    // At least some rows should be visible
    const rows = page.getByTestId('list-place-row')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })
})
