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

test.describe('Save Frequency Chart', () => {
  test('save frequency section is visible in analytics view', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const section = page.getByTestId('save-frequency-section')
    await expect(section).toBeVisible({ timeout: 8000 })
    await expect(section).toContainText('Save Frequency')
  })

  test('shows peak month and avg badges', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const section = page.getByTestId('save-frequency-section')
    await expect(section).toBeVisible({ timeout: 8000 })

    // Should show peak month badge
    const peakMonthBadge = page.getByTestId('freq-peak-month')
    await expect(peakMonthBadge).toBeVisible()

    // Should show avg badge
    const avgBadge = page.getByTestId('freq-avg')
    await expect(avgBadge).toBeVisible()
    await expect(avgBadge).toContainText('/mo')
  })

  test('monthly tab shows bar chart with month bars', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    // Monthly tab is active by default
    const monthlyChart = page.getByTestId('freq-monthly-chart')
    await expect(monthlyChart).toBeVisible({ timeout: 8000 })

    const bars = page.getByTestId('freq-month-bar')
    const barCount = await bars.count()
    expect(barCount).toBeGreaterThan(0)
  })

  test('day-of-week tab shows 7 day rows', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const section = page.getByTestId('save-frequency-section')
    await expect(section).toBeVisible({ timeout: 8000 })

    // Switch to By Day tab
    await page.getByTestId('freq-tab-dow').click()
    await page.waitForTimeout(300)

    const chart = page.getByTestId('freq-dow-chart')
    await expect(chart).toBeVisible()

    const rows = page.getByTestId('freq-dow-row')
    const rowCount = await rows.count()
    expect(rowCount).toBe(7)
  })

  test('yearly tab shows year rows with heatmaps', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const section = page.getByTestId('save-frequency-section')
    await expect(section).toBeVisible({ timeout: 8000 })

    // Switch to By Year tab
    await page.getByTestId('freq-tab-yearly').click()
    await page.waitForTimeout(300)

    const chart = page.getByTestId('freq-yearly-chart')
    await expect(chart).toBeVisible()

    const rows = page.getByTestId('freq-year-row')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
  })
})
