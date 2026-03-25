import { test, expect } from '@playwright/test'

async function loadDemoData(page: any) {
  await page.goto('/')
  await page.getByText('Load demo data instead →').click()
  await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)
}

test.describe('Custom map styles', () => {
  test('map style toggle button is visible on map view', async ({ page }) => {
    await loadDemoData(page)
    const styleBtn = page.getByTestId('map-style-toggle')
    await expect(styleBtn).toBeVisible()
    // Default style is Dark
    await expect(styleBtn).toContainText('Dark')
  })

  test('style menu opens with all 4 options when toggle is clicked', async ({ page }) => {
    await loadDemoData(page)
    const styleBtn = page.getByTestId('map-style-toggle')
    await styleBtn.click()

    const menu = page.getByTestId('map-style-menu')
    await expect(menu).toBeVisible()

    // All 4 styles should appear
    await expect(page.getByTestId('map-style-option-dark')).toBeVisible()
    await expect(page.getByTestId('map-style-option-light')).toBeVisible()
    await expect(page.getByTestId('map-style-option-streets')).toBeVisible()
    await expect(page.getByTestId('map-style-option-satellite')).toBeVisible()
  })

  test('selecting Light style updates button label and closes menu', async ({ page }) => {
    await loadDemoData(page)
    const styleBtn = page.getByTestId('map-style-toggle')
    await styleBtn.click()

    await page.getByTestId('map-style-option-light').click()
    await page.waitForTimeout(300)

    // Menu should be closed
    await expect(page.getByTestId('map-style-menu')).not.toBeVisible()
    // Button should now show Light
    await expect(styleBtn).toContainText('Light')
  })

  test('selecting Satellite style updates button label', async ({ page }) => {
    await loadDemoData(page)
    const styleBtn = page.getByTestId('map-style-toggle')
    await styleBtn.click()

    await page.getByTestId('map-style-option-satellite').click()
    await page.waitForTimeout(300)

    await expect(styleBtn).toContainText('Satellite')
  })

  test('Esc key closes the style menu', async ({ page }) => {
    await loadDemoData(page)
    const styleBtn = page.getByTestId('map-style-toggle')
    await styleBtn.click()

    await expect(page.getByTestId('map-style-menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    await expect(page.getByTestId('map-style-menu')).not.toBeVisible()
  })
})
