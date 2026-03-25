/**
 * Time-of-Day Pattern Analysis
 *
 * Parses save timestamps to determine when during the day/week the user
 * tends to save places (morning / afternoon / evening / night).
 */

import type { Place } from './types'

export interface TimeOfDayBucket {
  label: string
  emoji: string
  hourRange: string
  count: number
  percentage: number
}

export interface TimeOfDayAnalysis {
  buckets: TimeOfDayBucket[]
  totalWithTime: number
  peakPeriod: TimeOfDayBucket | null
  hourDistribution: { hour: number; count: number }[]
}

const PERIODS = [
  { label: 'Morning', emoji: '🌅', startHour: 6, endHour: 12, hourRange: '6am–12pm' },
  { label: 'Afternoon', emoji: '☀️', startHour: 12, endHour: 17, hourRange: '12pm–5pm' },
  { label: 'Evening', emoji: '🌆', startHour: 17, endHour: 21, hourRange: '5pm–9pm' },
  { label: 'Night', emoji: '🌙', startHour: 21, endHour: 6, hourRange: '9pm–6am' },
]

function getPeriodIndex(hour: number): number {
  if (hour >= 6 && hour < 12) return 0  // Morning
  if (hour >= 12 && hour < 17) return 1 // Afternoon
  if (hour >= 17 && hour < 21) return 2 // Evening
  return 3 // Night
}

/**
 * Extract hour from an ISO date string.
 * Returns null if no time component exists.
 */
function extractHour(dateStr: string): number | null {
  // ISO dates with time: "2024-03-15T14:30:00Z" or "2024-03-15T14:30:00+09:00"
  if (!dateStr) return null
  const match = dateStr.match(/T(\d{2}):/)
  if (!match) return null
  const hour = parseInt(match[1], 10)
  if (isNaN(hour) || hour < 0 || hour > 23) return null
  return hour
}

export function analyzeTimeOfDay(places: Place[]): TimeOfDayAnalysis {
  const periodCounts = [0, 0, 0, 0]
  const hourCounts = new Array(24).fill(0)
  let totalWithTime = 0

  for (const place of places) {
    if (!place.date) continue
    const hour = extractHour(place.date)
    if (hour === null) continue
    totalWithTime++
    periodCounts[getPeriodIndex(hour)]++
    hourCounts[hour]++
  }

  const buckets: TimeOfDayBucket[] = PERIODS.map((p, i) => ({
    label: p.label,
    emoji: p.emoji,
    hourRange: p.hourRange,
    count: periodCounts[i],
    percentage: totalWithTime > 0 ? Math.round((periodCounts[i] / totalWithTime) * 100) : 0,
  }))

  const peakPeriod = totalWithTime > 0
    ? buckets.reduce((best, b) => (b.count > best.count ? b : best), buckets[0])
    : null

  const hourDistribution = hourCounts.map((count, hour) => ({ hour, count }))

  return { buckets, totalWithTime, peakPeriod, hourDistribution }
}
