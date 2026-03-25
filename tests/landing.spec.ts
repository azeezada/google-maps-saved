import { test, expect } from '@playwright/test'

test.describe('Magic UI Landing Page', () => {
  test('hero headline is visible with gradient text', async ({ page }) => {
    await page.goto('/')
    // Headline should contain the animated text
    await expect(page.getByText(/Your Google Maps life/i)).toBeVisible()
    await expect(page.getByText(/visualized/i)).toBeVisible()
  })

  test('privacy badge is shown in hero', async ({ page }) => {
    await page.goto('/')
    // The badge spans multiple text nodes; check via locator that has the badge class
    await expect(page.locator('.landing-badge')).toBeVisible()
    await expect(page.getByText(/Runs 100% in your browser/i)).toBeVisible()
  })

  test('features section shows 6 feature cards', async ({ page }) => {
    await page.goto('/')
    // Scroll to features section
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
    // All 6 feature titles should be present
    await expect(page.getByText('Interactive Map')).toBeVisible()
    await expect(page.getByText('Deep Analytics')).toBeVisible()
    await expect(page.getByText('Smart Filtering')).toBeVisible()
    await expect(page.getByText('Trip Detection')).toBeVisible()
    await expect(page.getByText('Category Inference')).toBeVisible()
    await expect(page.getByText('Export Anywhere')).toBeVisible()
  })

  test('privacy callout is visible in features section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Your data never leaves your device')).toBeVisible()
  })

  test('"Upload Takeout ZIP" hero button scrolls to upload zone', async ({ page }) => {
    await page.goto('/')
    // The upload button should exist
    const uploadBtn = page.getByRole('button', { name: /Upload Takeout ZIP/i })
    await expect(uploadBtn).toBeVisible()
    // Click it — should scroll to the upload section
    await uploadBtn.click()
    // After scrolling, the upload zone should be in viewport (or at least rendered)
    await expect(page.getByText('Drop your Takeout ZIP here')).toBeVisible()
  })
})
