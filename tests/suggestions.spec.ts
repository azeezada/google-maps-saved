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

test.describe('You Might Like Suggestions', () => {
  test('suggestions section is visible in analytics view', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    // Scroll to bottom to ensure section is rendered
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)

    const section = page.getByTestId('suggestions-section')
    await expect(section).toBeVisible({ timeout: 8000 })
    await expect(section).toContainText('You Might Like')
  })

  test('shows taste profile text', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)

    const profile = page.getByTestId('suggestions-taste-profile')
    await expect(profile).toBeVisible({ timeout: 8000 })
    const text = await profile.textContent()
    expect(text?.length).toBeGreaterThan(10)
  })

  test('renders suggestion cards with emoji, title and body', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)

    // Should have at least one suggestion card
    const cards = page.getByTestId('suggestion-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)

    // First card has emoji, title, and body
    const firstCard = cards.first()
    await expect(firstCard.getByTestId('suggestion-emoji')).toBeVisible()
    await expect(firstCard.getByTestId('suggestion-title')).toBeVisible()
    await expect(firstCard.getByTestId('suggestion-body')).toBeVisible()

    const title = await firstCard.getByTestId('suggestion-title').textContent()
    expect(title?.length).toBeGreaterThan(0)

    const body = await firstCard.getByTestId('suggestion-body').textContent()
    expect(body?.length).toBeGreaterThan(10)
  })

  test('suggestions grid renders inside the section', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)

    const grid = page.getByTestId('suggestions-grid')
    await expect(grid).toBeVisible({ timeout: 8000 })

    // Grid should contain at least one card
    const cards = grid.getByTestId('suggestion-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(6) // max 6 suggestions
  })

  test('idea count badge matches number of suggestions displayed', async ({ page }) => {
    await loadDemoData(page)
    await goToAnalytics(page)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)

    const section = page.getByTestId('suggestions-section')
    await expect(section).toBeVisible({ timeout: 8000 })

    // Extract idea count from header badge
    const headerText = await section.locator('div').first().textContent()
    const cardCount = await page.getByTestId('suggestion-card').count()

    // The count shown should match actual cards rendered
    expect(cardCount).toBeGreaterThan(0)
    // Section header should contain the count (e.g. "5 ideas")
    await expect(section).toContainText(`${cardCount} idea`)
  })
})
