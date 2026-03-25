import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURE_ZIP = path.join(__dirname, 'fixtures/takeout-test.zip')

test.describe('Export filtered data', () => {
  test('header export buttons appear after loading data', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Export buttons should be visible in header
    await expect(page.getByTestId('header-export-csv')).toBeVisible()
    await expect(page.getByTestId('header-export-json')).toBeVisible()
  })

  test('export CSV triggers file download', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-csv').click()
    const download = await downloadPromise

    // Verify file downloaded
    expect(download.suggestedFilename()).toMatch(/places-\d{4}-\d{2}-\d{2}\.csv/)
  })

  test('export JSON triggers file download', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-json').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/places-\d{4}-\d{2}-\d{2}\.json/)
  })

  test('CSV download contains valid content', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-csv').click()
    const download = await downloadPromise

    // Save to temp location and read
    const tmpPath = `/tmp/${download.suggestedFilename()}`
    await download.saveAs(tmpPath)

    const fs = await import('fs')
    const content = fs.readFileSync(tmpPath, 'utf-8')

    // Should have CSV headers
    expect(content).toContain('name,address,city,country,list,source')
    // Should have at least one data row (more than just header)
    const lines = content.trim().split('\n')
    expect(lines.length).toBeGreaterThan(1)
  })

  test('JSON download contains valid content', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-json').click()
    const download = await downloadPromise

    const tmpPath = `/tmp/${download.suggestedFilename()}`
    await download.saveAs(tmpPath)

    const fs = await import('fs')
    const content = fs.readFileSync(tmpPath, 'utf-8')

    // Should be parseable JSON
    const parsed = JSON.parse(content) as unknown
    expect(Array.isArray(parsed)).toBe(true)
    const places = parsed as Array<Record<string, unknown>>
    expect(places.length).toBeGreaterThan(0)

    // Each place should have key fields
    const first = places[0]
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('coordinates')
    expect(first).toHaveProperty('list')
  })

  test('list view also has export buttons', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Switch to list view
    await page.getByRole('button', { name: 'List', exact: true }).click()

    // List view has its own export buttons too
    await expect(page.getByTestId('export-csv')).toBeVisible()
    await expect(page.getByTestId('export-json')).toBeVisible()
  })

  test('export buttons disabled when no places match filter', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Search for something that matches no places — use the sidebar's search input (first match)
    const searchInput = page.getByPlaceholder('Search places...').first()
    await searchInput.fill('xyznotexistentplacename99999')
    await page.waitForTimeout(300)

    // Export buttons in header should be disabled when 0 filtered places
    const csvBtn = page.getByTestId('header-export-csv')
    await expect(csvBtn).toBeDisabled()
    const jsonBtn = page.getByTestId('header-export-json')
    await expect(jsonBtn).toBeDisabled()
  })

  test('export from ZIP upload works', async ({ page }) => {
    await page.goto('/')
    const fileInput = page.locator('input[type="file"][accept=".zip"]')
    await fileInput.setInputFiles(FIXTURE_ZIP)

    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 20000 })

    // Export buttons should appear
    await expect(page.getByTestId('header-export-csv')).toBeVisible()
    await expect(page.getByTestId('header-export-json')).toBeVisible()

    // Trigger CSV download
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-csv').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
  })
})
