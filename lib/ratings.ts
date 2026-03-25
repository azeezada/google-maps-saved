/**
 * Rating insights analysis
 *
 * Analyzes user rating patterns compared to averages,
 * identifies generous/harsh rating tendencies, and
 * provides distribution breakdowns.
 */

import type { Place } from './types'

export interface RatingInsights {
  /** Total number of rated places */
  totalRated: number
  /** User's average rating */
  userAverage: number
  /** Distribution of ratings: key is 1-5 */
  distribution: Record<number, number>
  /** Rating tendency: generous (>3.5), harsh (<2.5), balanced */
  tendency: 'generous' | 'harsh' | 'balanced'
  /** Category with highest average rating */
  highestRatedCategory: { category: string; average: number; count: number } | null
  /** Category with lowest average rating */
  lowestRatedCategory: { category: string; average: number; count: number } | null
  /** Ratings by category */
  byCategory: { category: string; average: number; count: number }[]
  /** Rating over time (by month) */
  byMonth: { month: string; average: number; count: number }[]
  /** Most common rating */
  modeRating: number
}

export function analyzeRatings(places: Place[]): RatingInsights {
  const rated = places.filter(p => p.rating != null && p.rating > 0)

  if (rated.length === 0) {
    return {
      totalRated: 0,
      userAverage: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      tendency: 'balanced',
      highestRatedCategory: null,
      lowestRatedCategory: null,
      byCategory: [],
      byMonth: [],
      modeRating: 0,
    }
  }

  // Distribution
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let ratingSum = 0
  for (const p of rated) {
    const r = Math.round(p.rating!)
    distribution[r] = (distribution[r] || 0) + 1
    ratingSum += p.rating!
  }

  const userAverage = ratingSum / rated.length

  // Mode (most common rating)
  let modeRating = 1
  let modeCount = 0
  for (const [r, count] of Object.entries(distribution)) {
    if (count > modeCount) {
      modeRating = parseInt(r)
      modeCount = count
    }
  }

  // Tendency
  let tendency: RatingInsights['tendency'] = 'balanced'
  if (userAverage >= 3.8) tendency = 'generous'
  else if (userAverage <= 2.5) tendency = 'harsh'

  // By category
  const catMap = new Map<string, { sum: number; count: number }>()
  for (const p of rated) {
    const cat = p.category || 'Other'
    const entry = catMap.get(cat) || { sum: 0, count: 0 }
    entry.sum += p.rating!
    entry.count++
    catMap.set(cat, entry)
  }

  const byCategory = Array.from(catMap.entries())
    .map(([category, { sum, count }]) => ({
      category,
      average: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .filter(c => c.count >= 1)
    .sort((a, b) => b.average - a.average)

  const highestRatedCategory = byCategory.length > 0 ? byCategory[0] : null
  const lowestRatedCategory = byCategory.length > 1 ? byCategory[byCategory.length - 1] : null

  // By month
  const monthMap = new Map<string, { sum: number; count: number }>()
  for (const p of rated) {
    if (!p.date) continue
    const month = p.date.substring(0, 7)
    const entry = monthMap.get(month) || { sum: 0, count: 0 }
    entry.sum += p.rating!
    entry.count++
    monthMap.set(month, entry)
  }

  const byMonth = Array.from(monthMap.entries())
    .map(([month, { sum, count }]) => ({
      month,
      average: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalRated: rated.length,
    userAverage: Math.round(userAverage * 10) / 10,
    distribution,
    tendency,
    highestRatedCategory,
    lowestRatedCategory,
    byCategory,
    byMonth,
    modeRating,
  }
}
