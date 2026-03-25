import { test, expect } from '@playwright/test'

async function loadDemoData(page: any) {
  await page.goto('/')
  await page.getByText('Load demo data instead →').click()
  // Wait for app to load into map view
  await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
  // Wait a bit for the map to initialize
  await page.waitForTimeout(1000)
}

test.describe('Heatmap layer', () => {
  test('heatmap toggle button is visible on map view', async ({ page }) => {
    await loadDemoData(page)
    const heatmapBtn = page.getByTestId('heatmap-toggle')
    await expect(heatmapBtn).toBeVisible()
    await expect(heatmapBtn).toContainText('Heatmap')
  })

  test('cluster toggle is visible by default alongside heatmap toggle', async ({ page }) => {
    await loadDemoData(page)
    const clusterBtn = page.getByTestId('cluster-toggle')
    await expect(clusterBtn).toBeVisible()
    await expect(clusterBtn).toContainText(/Clustered|All pins/)
  })

  test('cluster toggle is hidden when heatmap is enabled', async ({ page }) => {
    await loadDemoData(page)
    const heatmapBtn = page.getByTestId('heatmap-toggle')
    const clusterBtn = page.getByTestId('cluster-toggle')

    // Cluster toggle visible initially
    await expect(clusterBtn).toBeVisible()

    // Enable heatmap
    await heatmapBtn.click()
    await page.waitForTimeout(300)

    // Cluster toggle should be hidden when heatmap is on
    await expect(clusterBtn).not.toBeVisible()
  })

  test('turning heatmap off restores cluster toggle', async ({ page }) => {
    await loadDemoData(page)
    const heatmapBtn = page.getByTestId('heatmap-toggle')
    const clusterBtn = page.getByTestId('cluster-toggle')

    // Enable heatmap
    await heatmapBtn.click()
    await page.waitForTimeout(300)
    await expect(clusterBtn).not.toBeVisible()

    // Disable heatmap
    await heatmapBtn.click()
    await page.waitForTimeout(300)

    // Cluster toggle should return
    await expect(clusterBtn).toBeVisible()
  })

  test('heatmap canvas renders in leaflet overlay pane after enabling', async ({ page }) => {
    await loadDemoData(page)
    const heatmapBtn = page.getByTestId('heatmap-toggle')
    await heatmapBtn.click()
    await page.waitForTimeout(1500)

    // leaflet.heat renders a canvas with class 'leaflet-heatmap-layer' inside the overlay pane
    const canvas = page.locator('canvas.leaflet-heatmap-layer')
    await expect(canvas.first()).toBeAttached({ timeout: 8000 })
  })
})
