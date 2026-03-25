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

test.describe('Distance from Home/Work', () => {
  test('distance section is visible in analytics view', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const section = page.getByTestId('distance-section')
    await expect(section).toBeVisible({ timeout: 8000 })
    await expect(section).toContainText('Distance from Reference Points')
  })

  test('displays distance stats (nearest, farthest, average, median)', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const stats = page.getByTestId('distance-stats')
    await expect(stats).toBeVisible({ timeout: 8000 })
    await expect(stats).toContainText('Nearest')
    await expect(stats).toContainText('Farthest')
    await expect(stats).toContainText('Average')
    await expect(stats).toContainText('Median')
  })

  test('renders distance bucket distribution bars', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const buckets = page.getByTestId('distance-buckets')
    await expect(buckets).toBeVisible({ timeout: 8000 })

    const rows = page.getByTestId('distance-bucket-row')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('reference point tabs are shown when multiple refs exist', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    // Demo data has Home + Work at minimum — tabs should appear
    const tabs = page.getByTestId('distance-ref-tabs')
    await expect(tabs).toBeVisible({ timeout: 8000 })

    // At least 2 tabs (Home + Work)
    const tabButtons = tabs.locator('button')
    const tabCount = await tabButtons.count()
    expect(tabCount).toBeGreaterThanOrEqual(2)
  })

  test('clicking a tab switches reference point and shows closest places', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const tabs = page.getByTestId('distance-ref-tabs')
    await expect(tabs).toBeVisible({ timeout: 8000 })

    // Click the second tab
    const secondTab = page.getByTestId('distance-tab-1')
    await secondTab.click()
    await page.waitForTimeout(300)

    // Confirm the section still shows
    const section = page.getByTestId('distance-section')
    await expect(section).toBeVisible()

    // Expand the closest places toggle
    const toggle = page.getByTestId('distance-top-toggle')
    await toggle.click()
    await page.waitForTimeout(300)

    const topList = page.getByTestId('distance-top-list')
    await expect(topList).toBeVisible()

    const placeRows = page.getByTestId('distance-place-row')
    const count = await placeRows.count()
    expect(count).toBeGreaterThan(0)
  })
})
