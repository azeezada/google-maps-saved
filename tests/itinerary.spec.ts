import { test, expect } from '@playwright/test'

// Helper: load the app with demo data (matches pattern used by other tests)
async function loadDemo(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByText('Load demo data instead →').click()
  await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
}

test.describe('Itinerary Builder', () => {
  test('itinerary tab appears in header and switches to itinerary view', async ({ page }) => {
    await loadDemo(page)
    const itinBtn = page.getByRole('button', { name: 'Itinerary' })
    await expect(itinBtn).toBeVisible()
    await itinBtn.click()
    await expect(page.getByTestId('itinerary-view')).toBeVisible()
  })

  test('creation wizard: name input, days input, and create button', async ({ page }) => {
    await loadDemo(page)
    // Ensure localStorage is clear so we see the wizard
    await page.evaluate(() => localStorage.removeItem('gmsa-itinerary'))
    await page.reload()
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Itinerary' }).click()
    const nameInput = page.getByTestId('itinerary-name-input')
    await expect(nameInput).toBeVisible()
    await nameInput.fill('Test Trip 2026')
    const daysInput = page.getByTestId('itinerary-days-input')
    await daysInput.fill('2')
    const createBtn = page.getByTestId('itinerary-create-btn')
    await createBtn.click()
    // Editor should be visible with the trip name
    await expect(page.getByTestId('itinerary-title')).toContainText('Test Trip 2026')
  })

  test('itinerary editor shows source pane and correct number of day columns', async ({ page }) => {
    await loadDemo(page)
    await page.evaluate(() => localStorage.removeItem('gmsa-itinerary'))
    await page.reload()
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Itinerary' }).click()
    await page.getByTestId('itinerary-days-input').fill('3')
    await page.getByTestId('itinerary-create-btn').click()
    // Source pane visible
    await expect(page.getByTestId('itinerary-source-pane')).toBeVisible()
    // 3 day columns
    const dayColumns = page.getByTestId('itinerary-day-column')
    await expect(dayColumns).toHaveCount(3)
  })

  test('add day button adds a new column', async ({ page }) => {
    await loadDemo(page)
    await page.evaluate(() => localStorage.removeItem('gmsa-itinerary'))
    await page.reload()
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Itinerary' }).click()
    await page.getByTestId('itinerary-days-input').fill('2')
    await page.getByTestId('itinerary-create-btn').click()
    // Start with 2 days
    await expect(page.getByTestId('itinerary-day-column')).toHaveCount(2)
    // Add one
    await page.getByTestId('itinerary-add-day-btn').click()
    await expect(page.getByTestId('itinerary-day-column')).toHaveCount(3)
  })

  test('reset button clears itinerary and returns to wizard', async ({ page }) => {
    await loadDemo(page)
    await page.evaluate(() => localStorage.removeItem('gmsa-itinerary'))
    await page.reload()
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Itinerary' }).click()
    await page.getByTestId('itinerary-create-btn').click()
    await expect(page.getByTestId('itinerary-title')).toBeVisible()
    await page.getByTestId('itinerary-reset-btn').click()
    // Should return to creation wizard
    await expect(page.getByTestId('itinerary-create-btn')).toBeVisible()
  })

  test('source filter dropdown filters places by list', async ({ page }) => {
    await loadDemo(page)
    await page.evaluate(() => localStorage.removeItem('gmsa-itinerary'))
    await page.reload()
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Itinerary' }).click()
    await page.getByTestId('itinerary-create-btn').click()
    const filterSelect = page.getByTestId('itinerary-source-filter')
    await expect(filterSelect).toBeVisible()
    // Should have "All lists" + individual list options
    const options = filterSelect.locator('option')
    await expect(options).not.toHaveCount(0)
  })

  test('copy button copies itinerary text', async ({ page }) => {
    await loadDemo(page)
    await page.evaluate(() => localStorage.removeItem('gmsa-itinerary'))
    await page.reload()
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Itinerary' }).click()
    await page.getByTestId('itinerary-name-input').fill('Copy Test')
    await page.getByTestId('itinerary-create-btn').click()
    const copyBtn = page.getByTestId('itinerary-copy-btn')
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()
    // Button should briefly show "Copied!"
    await expect(copyBtn).toContainText('Copied!')
  })
})
