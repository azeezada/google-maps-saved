import { test, expect } from '@playwright/test'

async function loadDemo(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByText('Load demo data instead →').click()
  await expect(page.getByText('Places Analyzer')).toBeVisible({ timeout: 15000 })
}

test.describe('City Knowledge Quiz', () => {
  test('quiz tab appears in header and renders setup screen', async ({ page }) => {
    await loadDemo(page)
    await page.getByTestId('view-quiz').click()
    await expect(page.getByTestId('quiz-view')).toBeVisible()
    await expect(page.getByTestId('quiz-setup')).toBeVisible()
    await expect(page.getByTestId('quiz-city-select')).toBeVisible()
    await expect(page.getByTestId('quiz-start-btn')).toBeVisible()
  })

  test('question count buttons work (5/10/15/20)', async ({ page }) => {
    await loadDemo(page)
    await page.getByTestId('view-quiz').click()
    await expect(page.getByTestId('quiz-count-5')).toBeVisible()
    await expect(page.getByTestId('quiz-count-10')).toBeVisible()
    await page.getByTestId('quiz-count-5').click()
    // After clicking 5, the button should be highlighted (primary color)
    await expect(page.getByTestId('quiz-count-5')).toHaveClass(/bg-\[var\(--primary\)\]/)
  })

  test('starting quiz shows a question card', async ({ page }) => {
    await loadDemo(page)
    await page.getByTestId('view-quiz').click()
    await page.getByTestId('quiz-count-5').click()
    await page.getByTestId('quiz-start-btn').click()
    await expect(page.getByTestId('quiz-question-card')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('quiz-question-text')).toBeVisible()
    // All 4 answer buttons visible
    for (let i = 0; i < 4; i++) {
      await expect(page.getByTestId(`quiz-answer-${i}`)).toBeVisible()
    }
  })

  test('answering a question advances to next and eventually shows results', async ({ page }) => {
    await loadDemo(page)
    await page.getByTestId('view-quiz').click()
    await page.getByTestId('quiz-count-5').click()
    await page.getByTestId('quiz-start-btn').click()

    // Answer all 5 questions by clicking the first answer each time
    for (let q = 0; q < 5; q++) {
      await expect(page.getByTestId('quiz-question-card')).toBeVisible({ timeout: 5000 })
      await page.getByTestId('quiz-answer-0').click()
      // Wait for transition (900ms delay in component)
      await page.waitForTimeout(1100)
    }

    // Results screen should appear
    await expect(page.getByTestId('quiz-results')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('quiz-score')).toBeVisible()
    await expect(page.getByTestId('quiz-retry-btn')).toBeVisible()
  })

  test('quiz results show review rows and retry button works', async ({ page }) => {
    await loadDemo(page)
    await page.getByTestId('view-quiz').click()
    await page.getByTestId('quiz-count-5').click()
    await page.getByTestId('quiz-start-btn').click()

    for (let q = 0; q < 5; q++) {
      await expect(page.getByTestId('quiz-question-card')).toBeVisible({ timeout: 5000 })
      await page.getByTestId('quiz-answer-0').click()
      await page.waitForTimeout(1100)
    }

    await expect(page.getByTestId('quiz-results')).toBeVisible({ timeout: 5000 })
    const reviewRows = page.getByTestId('quiz-review-row')
    const count = await reviewRows.count()
    expect(count).toBe(5)

    // Retry brings back setup
    await page.getByTestId('quiz-retry-btn').click()
    await expect(page.getByTestId('quiz-setup')).toBeVisible()
  })
})
