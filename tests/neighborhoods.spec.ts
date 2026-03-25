import { test, expect } from '@playwright/test'

async function loadDemoData(page: any) {
  await page.goto('/')
  await page.getByText('Load demo data instead →').click()
  await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(800)
}

async function goToAnalytics(page: any) {
  await page.getByRole('button', { name: /Analytics/ }).click()
  await page.waitForTimeout(500)
}

test.describe('Neighborhood Analysis', () => {
  test('neighborhoods section is visible in analytics view', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const section = page.getByTestId('neighborhoods-section')
    await expect(section).toBeVisible({ timeout: 8000 })
    await expect(section).toContainText('Neighborhood Analysis')
  })

  test('neighborhood list renders at least one row', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const rows = page.getByTestId('neighborhood-row')
    await expect(rows.first()).toBeVisible({ timeout: 8000 })
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('areas count label shows correct number', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const section = page.getByTestId('neighborhoods-section')
    // Should show something like "N areas"
    await expect(section).toContainText(/\d+ area/)
  })

  test('clicking a neighborhood row expands detail panel', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const firstRow = page.getByTestId('neighborhood-row').first()
    await firstRow.click()
    await page.waitForTimeout(300)

    const detail = page.getByTestId('neighborhood-detail')
    await expect(detail).toBeVisible({ timeout: 5000 })
    // Should show "By List" and "Places" headings
    await expect(detail).toContainText('By List')
    await expect(detail).toContainText('Places')
  })

  test('clicking expanded row again collapses it', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    const firstRow = page.getByTestId('neighborhood-row').first()
    // Expand
    await firstRow.click()
    await page.waitForTimeout(300)
    await expect(page.getByTestId('neighborhood-detail')).toBeVisible()

    // Collapse (find the button inside the row)
    const btn = firstRow.locator('button').first()
    await btn.click()
    await page.waitForTimeout(300)
    await expect(page.getByTestId('neighborhood-detail')).not.toBeVisible()
  })
})
