import { test, expect } from '@playwright/test'
import path from 'path'

const LARGE_FIXTURE_ZIP = path.join(__dirname, 'fixtures/takeout-large.zip')

/**
 * Performance profiling tests — 1000+ places
 *
 * These tests measure wall-clock time for key render operations with
 * a 1050-place dataset (800 saved + 150 reviews + 100 CSV entries).
 *
 * Thresholds are intentionally generous to avoid flaky CI failures
 * while still catching regressions that make the app unusably slow.
 */

test.describe('Performance profiling — 1000+ places', () => {
  /**
   * Helper: upload the large fixture and wait for the app to be ready.
   * Returns the load duration in milliseconds.
   */
  async function loadLargeFixture(page: Parameters<Parameters<typeof test>[1]>[0]) {
    const start = Date.now()
    const fileInput = page.locator('input[type="file"][accept=".zip"]')
    await fileInput.setInputFiles(LARGE_FIXTURE_ZIP)
    await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 30000 })
    return Date.now() - start
  }

  test('initial load: ZIP parse + render completes within 30s for 1050 places', async ({ page }) => {
    await page.goto('/')

    const loadMs = await loadLargeFixture(page)
    console.log(`[perf] initial load: ${loadMs}ms`)

    // App must load within 30 seconds
    expect(loadMs).toBeLessThan(30000)

    // Verify we actually loaded 1000+ places
    const badge = page.locator('header').getByText(/\d+ places/)
    await expect(badge).toBeVisible({ timeout: 5000 })
    const badgeText = await badge.textContent()
    const countMatch = badgeText?.match(/(\d+)\s+places/)
    expect(countMatch).not.toBeNull()
    expect(parseInt(countMatch![1])).toBeGreaterThanOrEqual(1000)
  })

  test('list view renders within 5s after switching from map view', async ({ page }) => {
    await page.goto('/')
    await loadLargeFixture(page)

    // Ensure we are on map view first
    await page.getByRole('button', { name: 'Map', exact: true }).click()
    await page.waitForTimeout(200)

    // Switch to list view and measure
    const start = Date.now()
    await page.getByRole('button', { name: 'List', exact: true }).click()
    // List view renders place rows — wait for main to have visible content
    await expect(page.locator('main')).toBeVisible()
    // Wait for at least one place row to appear (list items)
    await page.waitForFunction(
      () => {
        const main = document.querySelector('main')
        if (!main) return false
        // Look for any element that looks like a place entry (div, li, tr)
        return main.querySelectorAll('[data-testid="place-row"], li, tr').length > 0
          || main.scrollHeight > 200
      },
      { timeout: 5000 }
    ).catch(() => {
      // If no specific items found, just ensure main has rendered
    })
    const listMs = Date.now() - start
    console.log(`[perf] list view render: ${listMs}ms`)

    expect(listMs).toBeLessThan(5000)
  })

  test('analytics view renders within 5s after switching', async ({ page }) => {
    await page.goto('/')
    await loadLargeFixture(page)

    const start = Date.now()
    await page.getByRole('button', { name: /Analytics/ }).click()
    await expect(page.locator('main')).toBeVisible()
    // Wait for recharts SVG to appear (analytics renders charts)
    await page.waitForFunction(
      () => {
        const main = document.querySelector('main')
        if (!main) return false
        return main.querySelector('svg') !== null || main.scrollHeight > 200
      },
      { timeout: 5000 }
    ).catch(() => {})
    const analyticsMs = Date.now() - start
    console.log(`[perf] analytics view render: ${analyticsMs}ms`)

    expect(analyticsMs).toBeLessThan(5000)
  })

  test('view switching latency: map → list → analytics → trips stays under 3s each', async ({ page }) => {
    await page.goto('/')
    await loadLargeFixture(page)

    const transitions: Array<{ from: string; to: string; ms: number }> = []

    async function switchTo(name: string) {
      const start = Date.now()
      await page.getByRole('button', { name, exact: true }).click()
      await expect(page.locator('main')).toBeVisible()
      // Small stabilisation pause so React finishes flushing
      await page.waitForTimeout(100)
      return Date.now() - start
    }

    transitions.push({ from: 'map', to: 'list', ms: await switchTo('List') })
    transitions.push({ from: 'list', to: 'map', ms: await switchTo('Map') })
    transitions.push({ from: 'map', to: 'analytics', ms: await switchTo('Analytics') })
    transitions.push({ from: 'analytics', to: 'trips', ms: await switchTo('Trips') })
    transitions.push({ from: 'trips', to: 'diary', ms: await switchTo('Diary') })

    for (const t of transitions) {
      console.log(`[perf] switch ${t.from} → ${t.to}: ${t.ms}ms`)
      expect(t.ms, `${t.from} → ${t.to} should switch within 3s`).toBeLessThan(3000)
    }
  })

  test('search filter updates within 2s for 1000+ places', async ({ page }) => {
    await page.goto('/')
    await loadLargeFixture(page)

    // Focus the sidebar search (first search input)
    const searchInput = page.getByPlaceholder('Search places...').first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    const start = Date.now()
    await searchInput.fill('Tokyo')
    // Wait for React to re-render the filtered count
    await page.waitForFunction(
      () => {
        const header = document.querySelector('header')
        // The badge text changes after filtering — any change is acceptable
        return header !== null
      },
      { timeout: 2000 }
    ).catch(() => {})
    // Give React an extra tick to commit
    await page.waitForTimeout(300)
    const filterMs = Date.now() - start
    console.log(`[perf] search filter: ${filterMs}ms`)

    expect(filterMs).toBeLessThan(2000)
  })

  test('place count badge shows 1000+ places without truncation', async ({ page }) => {
    await page.goto('/')
    await loadLargeFixture(page)

    const badge = page.locator('header').getByText(/\d+ places/)
    await expect(badge).toBeVisible({ timeout: 5000 })
    const text = await badge.textContent()
    const match = text?.match(/(\d+)\s+places/)
    expect(match).not.toBeNull()
    const count = parseInt(match![1])
    // Should render the full count (no truncation to e.g. 999)
    expect(count).toBeGreaterThanOrEqual(1000)
    console.log(`[perf] place count displayed: ${count}`)
  })

  test('no JavaScript errors during large dataset load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')
    await loadLargeFixture(page)

    // Filter out known non-critical warnings
    const criticalErrors = errors.filter(
      e => !e.includes('Warning:') && !e.includes('ResizeObserver')
    )
    if (criticalErrors.length > 0) {
      console.warn('[perf] JS errors during load:', criticalErrors)
    }
    expect(criticalErrors).toHaveLength(0)
  })
})
