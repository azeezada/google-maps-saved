/**
 * Save Frequency Analysis
 * Analyzes when the user saves places over time:
 *  - Monthly counts (with rolling 3-month average)
 *  - Day-of-week distribution
 *  - Year-over-year comparison
 */

import type { Place } from './types'

export interface MonthBucket {
  month: string       // 'YYYY-MM'
  label: string       // 'Jan 2025'
  count: number
  rollingAvg: number  // 3-month rolling average
}

export interface DayOfWeekBucket {
  day: string         // 'Mon', 'Tue', etc.
  count: number
  percentage: number
}

export interface YearBucket {
  year: number
  count: number
  months: Record<string, number>  // 'MM' -> count
}

export interface SaveFrequencyAnalysis {
  months: MonthBucket[]
  dayOfWeek: DayOfWeekBucket[]
  years: YearBucket[]
  peakMonth: MonthBucket | null
  peakDay: DayOfWeekBucket | null
  totalWithDates: number
  avgPerMonth: number
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function analyzeSaveFrequency(places: Place[]): SaveFrequencyAnalysis {
  const datedPlaces = places.filter(p => p.date && p.date.length >= 7)
  const totalWithDates = datedPlaces.length

  // ── Monthly buckets ──────────────────────────────────────────────
  const monthCounts: Record<string, number> = {}
  const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  const yearData: Record<number, { count: number; months: Record<string, number> }> = {}

  for (const p of datedPlaces) {
    const d = new Date(p.date!)
    if (isNaN(d.getTime())) continue

    const yearNum = d.getFullYear()
    const monthKey = p.date!.substring(0, 7)  // 'YYYY-MM'
    const dayIdx = d.getDay()                  // 0=Sun, 6=Sat
    const monthMM = String(d.getMonth() + 1).padStart(2, '0')

    monthCounts[monthKey] = (monthCounts[monthKey] ?? 0) + 1
    dayCounts[dayIdx] = (dayCounts[dayIdx] ?? 0) + 1

    if (!yearData[yearNum]) yearData[yearNum] = { count: 0, months: {} }
    yearData[yearNum].count++
    yearData[yearNum].months[monthMM] = (yearData[yearNum].months[monthMM] ?? 0) + 1
  }

  // Fill in all months between earliest and latest (no gaps)
  const sortedMonthKeys = Object.keys(monthCounts).sort()
  const allMonths: string[] = []

  if (sortedMonthKeys.length >= 2) {
    const [firstYear, firstMonth] = sortedMonthKeys[0].split('-').map(Number)
    const [lastYear, lastMonth] = sortedMonthKeys[sortedMonthKeys.length - 1].split('-').map(Number)

    let y = firstYear, m = firstMonth
    while (y < lastYear || (y === lastYear && m <= lastMonth)) {
      allMonths.push(`${y}-${String(m).padStart(2, '0')}`)
      m++
      if (m > 12) { m = 1; y++ }
    }
  } else {
    allMonths.push(...sortedMonthKeys)
  }

  // Build month buckets with rolling 3-month average
  const months: MonthBucket[] = allMonths.map((month, idx) => {
    const count = monthCounts[month] ?? 0
    const [y, mo] = month.split('-').map(Number)
    const label = `${MONTH_SHORT[mo - 1]} ${y}`

    // Rolling average: idx-1, idx, idx+1
    const prev = idx > 0 ? (monthCounts[allMonths[idx - 1]] ?? 0) : count
    const next = idx < allMonths.length - 1 ? (monthCounts[allMonths[idx + 1]] ?? 0) : count
    const rollingAvg = Math.round(((prev + count + next) / 3) * 10) / 10

    return { month, label, count, rollingAvg }
  })

  const avgPerMonth =
    months.length > 0 ? Math.round((totalWithDates / months.length) * 10) / 10 : 0

  const peakMonth = months.reduce<MonthBucket | null>(
    (best, m) => (!best || m.count > best.count ? m : best),
    null,
  )

  // ── Day of week ──────────────────────────────────────────────────
  const totalDays = Object.values(dayCounts).reduce((s, v) => s + v, 0)
  const dayOfWeek: DayOfWeekBucket[] = DAY_NAMES.map((day, i) => {
    const count = dayCounts[i] ?? 0
    return {
      day,
      count,
      percentage: totalDays > 0 ? Math.round((count / totalDays) * 100) : 0,
    }
  })

  // Reorder to Mon–Sun (more common for calendars)
  const monFirst = [...dayOfWeek.slice(1), dayOfWeek[0]]

  const peakDay = monFirst.reduce<DayOfWeekBucket | null>(
    (best, d) => (!best || d.count > best.count ? d : best),
    null,
  )

  // ── Years ────────────────────────────────────────────────────────
  const years: YearBucket[] = Object.entries(yearData)
    .map(([y, v]) => ({ year: Number(y), count: v.count, months: v.months }))
    .sort((a, b) => a.year - b.year)

  return {
    months,
    dayOfWeek: monFirst,
    years,
    peakMonth,
    peakDay,
    totalWithDates,
    avgPerMonth,
  }
}
