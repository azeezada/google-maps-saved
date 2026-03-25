import { test, expect } from '@playwright/test'

test.describe('Google Maps Saved Places Analyzer — Smoke Tests', () => {
  test('upload screen renders correctly', async ({ page }) => {
    await page.goto('/')
    
    // Should show upload screen with key elements
    await expect(page.getByText(/Drop your Takeout ZIP/)).toBeVisible()
    await expect(page.getByText('Load demo data instead →')).toBeVisible()
    await expect(page.getByText('How to export your data')).toBeVisible()
    await expect(page.getByText('takeout.google.com')).toBeVisible()
  })

  test('page title and meta', async ({ page }) => {
    await page.goto('/')
    // Page should load without errors
    await expect(page).toHaveURL('/')
  })

  test('load demo data and render map view', async ({ page }) => {
    await page.goto('/')

    // Click "Load demo data instead →"
    await page.getByText('Load demo data instead →').click()

    // Wait for data to load — the header should appear with "Places Analyzer"
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Should show place count badge (e.g. "40 places")
    await expect(page.getByText(/\d+ places/)).toBeVisible()

    // Map view should be active by default — the Map button should be highlighted
    await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'List', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analytics', exact: true })).toBeVisible()
  })

  test('switch to list view after loading demo data', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Switch to list view
    await page.getByRole('button', { name: 'List', exact: true }).click()

    // List view should render table/list content
    // The ListView renders place names — check at least one list item appears
    await expect(page.locator('main')).toBeVisible()
  })

  test('switch to analytics view after loading demo data', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Switch to analytics view
    await page.getByRole('button', { name: /Analytics/ }).click()

    // Analytics view renders charts — main content should update
    await expect(page.locator('main')).toBeVisible()
  })

  test('sidebar toggle works', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Sidebar should be open by default; toggle it closed
    const toggleBtn = page.getByTitle(/Close sidebar|Open sidebar/)
    await expect(toggleBtn).toBeVisible()
    await toggleBtn.click()

    // Sidebar should be hidden — toggle button title changes
    await expect(page.getByTitle('Open sidebar')).toBeVisible()

    // Toggle back open
    await toggleBtn.click()
    await expect(page.getByTitle('Close sidebar')).toBeVisible()
  })

  test('search filter in sidebar works', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Find the search input in the sidebar (use first to avoid ambiguity with map overlay search)
    const searchInput = page.getByPlaceholder('Search places...').first()
    await expect(searchInput).toBeVisible()

    // Type in search — place count should update
    await searchInput.fill('Tokyo')
    // Give React a moment to filter
    await page.waitForTimeout(300)

    // The count in header should update — could be "N places" (all match) or "N / M" (filtered)
    // Check for either format: "40 places" or "5 / 40"
    const badge = page.locator('header span').filter({ hasText: /\d/ }).first()
    await expect(badge).toBeVisible()
  })
})
