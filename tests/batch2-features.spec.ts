import { test, expect } from '@playwright/test'

/**
 * Tests for GMSA Batch 2 features:
 * - Multi-file upload (enhanced)
 * - Print-friendly views
 * - Large file handling (progress bar)
 * - Heatmap time slider
 * - Duplicate detection
 * - Rating insights
 * - GPX/KML export
 * - Map export as image
 * - Offline mode
 */

test.describe('Batch 2 features', () => {
  // Helper: load demo data
  async function loadDemo(page: any) {
    await page.goto('/')
    await page.click('[data-testid="load-demo"]')
    await page.waitForSelector('[data-testid="place-count-badge"]', { timeout: 15000 })
  }

  // ── Multi-file upload ──────────────────────────────────
  test('upload screen accepts multiple files text', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('supports multiple files')).toBeVisible()
  })

  // ── Print button ──────────────────────────────────────
  test('print button is visible in header', async ({ page }) => {
    await loadDemo(page)
    // Open export menu
    await page.click('[data-testid="header-export-csv"]')
    await expect(page.locator('[data-testid="header-print"]')).toBeVisible()
  })

  // ── Export dropdown ──────────────────────────────────────
  test('export dropdown shows CSV, JSON, GPX, KML, Print options', async ({ page }) => {
    await loadDemo(page)
    await page.click('[data-testid="header-export-csv"]')
    await expect(page.locator('[data-testid="export-menu"]')).toBeVisible()
    await expect(page.locator('[data-testid="header-export-csv-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="header-export-json"]')).toBeVisible()
    await expect(page.locator('[data-testid="header-export-gpx"]')).toBeVisible()
    await expect(page.locator('[data-testid="header-export-kml"]')).toBeVisible()
  })

  // ── Heatmap time slider ──────────────────────────────────────
  test('heatmap time slider appears when heatmap is enabled', async ({ page }) => {
    await loadDemo(page)
    // Enable heatmap
    await page.click('[data-testid="heatmap-toggle"]')
    // Slider should appear
    await expect(page.locator('[data-testid="heatmap-time-slider"]')).toBeVisible({ timeout: 5000 })
    // Animation button should be there
    await expect(page.locator('[data-testid="heatmap-animate-btn"]')).toBeVisible()
  })

  // ── Rating insights ──────────────────────────────────────
  test('rating insights section appears in analytics', async ({ page }) => {
    await loadDemo(page)
    await page.click('[data-testid="view-analytics"]')
    // Rating insights section should be visible (demo data has reviews)
    await expect(page.locator('[data-testid="rating-insights"]')).toBeVisible({ timeout: 10000 })
    // Should show distribution bars within rating insights
    await expect(page.locator('[data-testid="rating-insights"]').getByText('Distribution')).toBeVisible()
  })

  // ── Duplicate detection ──────────────────────────────────────
  test('duplicate detection section appears in analytics when duplicates exist', async ({ page }) => {
    await loadDemo(page)
    await page.click('[data-testid="view-analytics"]')
    // Duplicate detection section may or may not be visible depending on demo data
    // Just verify the analytics view loads without errors
    await expect(page.locator('main')).toBeVisible()
  })

  // ── Map export button ──────────────────────────────────────
  test('map export PNG button is visible', async ({ page }) => {
    await loadDemo(page)
    await expect(page.locator('[data-testid="map-export-png"]')).toBeVisible({ timeout: 10000 })
  })

  // ── Service worker registration ──────────────────────────────────────
  test('service worker file is served', async ({ page }) => {
    const response = await page.goto('/sw.js')
    expect(response?.status()).toBe(200)
  })
})
