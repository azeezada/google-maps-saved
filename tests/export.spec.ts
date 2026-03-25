import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURE_ZIP = path.join(__dirname, 'fixtures/takeout-test.zip')

test.describe('Export filtered data', () => {
  test('header export dropdown appears after loading data', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Export dropdown trigger should be visible in header
    await expect(page.getByTestId('header-export-csv')).toBeVisible()
  })

  test('export CSV triggers file download', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Open export dropdown
    await page.getByTestId('header-export-csv').click()
    await expect(page.getByTestId('export-menu')).toBeVisible()

    // Set up download listener and click CSV
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-csv-btn').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/places-\d{4}-\d{2}-\d{2}\.csv/)
  })

  test('export JSON triggers file download', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Switch to list view to avoid map search bar intercepting
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.waitForTimeout(300)

    // Open export dropdown
    await page.getByTestId('header-export-csv').click()
    await expect(page.getByTestId('export-menu')).toBeVisible()

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-json').click({ force: true })
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/places-\d{4}-\d{2}-\d{2}\.json/)
  })

  test('CSV download contains valid content', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Open export dropdown and click CSV
    await page.getByTestId('header-export-csv').click()
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-csv-btn').click()
    const download = await downloadPromise

    const tmpPath = `/tmp/${download.suggestedFilename()}`
    await download.saveAs(tmpPath)

    const fs = await import('fs')
    const content = fs.readFileSync(tmpPath, 'utf-8')

    expect(content).toContain('name,address,city,country,list,source')
    const lines = content.trim().split('\n')
    expect(lines.length).toBeGreaterThan(1)
  })

  test('JSON download contains valid content', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    // Switch to list view to avoid map search bar intercepting
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.waitForTimeout(300)

    await page.getByTestId('header-export-csv').click()
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-json').click({ force: true })
    const download = await downloadPromise

    const tmpPath = `/tmp/${download.suggestedFilename()}`
    await download.saveAs(tmpPath)

    const fs = await import('fs')
    const content = fs.readFileSync(tmpPath, 'utf-8')

    const parsed = JSON.parse(content) as unknown
    expect(Array.isArray(parsed)).toBe(true)
    const places = parsed as Array<Record<string, unknown>>
    expect(places.length).toBeGreaterThan(0)

    const first = places[0]
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('coordinates')
    expect(first).toHaveProperty('list')
  })

  test('list view also has export buttons', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'List', exact: true }).click()

    await expect(page.getByTestId('export-csv')).toBeVisible()
    await expect(page.getByTestId('export-json')).toBeVisible()
  })

  test('export dropdown disabled when no places match filter', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Load demo data instead →').click()
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })

    const searchInput = page.getByPlaceholder('Search places...').first()
    await searchInput.fill('xyznotexistentplacename99999')
    await page.waitForTimeout(300)

    const exportBtn = page.getByTestId('header-export-csv')
    await expect(exportBtn).toBeDisabled()
  })

  test('export from ZIP upload works', async ({ page }) => {
    await page.goto('/')
    const fileInput = page.locator('input[type="file"][accept=".zip"]').first()
    await fileInput.setInputFiles(FIXTURE_ZIP)

    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 20000 })

    await expect(page.getByTestId('header-export-csv')).toBeVisible()

    // Open dropdown and download CSV
    await page.getByTestId('header-export-csv').click()
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByTestId('header-export-csv-btn').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
  })
})
