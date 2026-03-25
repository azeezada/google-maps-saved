/**
 * Multi-file merge utilities
 *
 * Merges two or more ParsedData objects into one, deduplicating places by
 * (name + approximate coordinates) to avoid counting the same place twice
 * when the user uploads multiple Google Takeout ZIPs.
 */

import type { ParsedData, Place, DataStats } from './types'

/** Round a coordinate to 4 decimal places (~11 m precision) for dedup key. */
function roundCoord(n: number): string {
  return n.toFixed(4)
}

/**
 * Build a deduplication key for a place.
 * Prefers coordinates if non-zero, otherwise uses a normalised name+list.
 */
function dedupKey(p: Place): string {
  if (p.coordinates.lat !== 0 || p.coordinates.lng !== 0) {
    return `${roundCoord(p.coordinates.lat)},${roundCoord(p.coordinates.lng)}:${p.name.toLowerCase().trim()}`
  }
  // CSV places with no coords — dedup by name+list
  return `nocoord:${p.name.toLowerCase().trim()}:${p.list.toLowerCase().trim()}`
}

/** Recompute stats from a merged place list. */
function recomputeStats(places: Place[]): DataStats {
  const placesByList: Record<string, number> = {}
  const placesByCountry: Record<string, number> = {}
  const placesByCity: Record<string, number> = {}
  const placesByMonth: Record<string, number> = {}
  let ratingSum = 0
  let ratingCount = 0
  let reviewCount = 0

  for (const p of places) {
    placesByList[p.list] = (placesByList[p.list] || 0) + 1
    if (p.country) placesByCountry[p.country] = (placesByCountry[p.country] || 0) + 1
    if (p.city && p.city !== 'Unknown') placesByCity[p.city] = (placesByCity[p.city] || 0) + 1
    if (p.date) {
      const month = p.date.substring(0, 7)
      placesByMonth[month] = (placesByMonth[month] || 0) + 1
    }
    if (p.rating != null) {
      ratingSum += p.rating
      ratingCount++
    }
    if (p.source === 'review') reviewCount++
  }

  return {
    totalPlaces: places.length,
    totalReviews: reviewCount,
    totalLists: Object.keys(placesByList).length,
    totalLabels: 0, // updated in mergeParsedData
    totalCommuteRoutes: 0, // updated in mergeParsedData
    averageRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
    placesByList,
    placesByCountry,
    placesByCity,
    placesByMonth,
  }
}

/**
 * Merge an array of ParsedData objects into a single ParsedData.
 * Later entries win on conflicts; duplicates are removed.
 */
export function mergeParsedData(datasets: ParsedData[]): ParsedData {
  if (datasets.length === 0) throw new Error('No datasets to merge')
  if (datasets.length === 1) return datasets[0]

  const seenKeys = new Map<string, Place>()

  // Process all places — later datasets overwrite earlier ones for the same key
  for (const ds of datasets) {
    for (const p of ds.places) {
      seenKeys.set(dedupKey(p), p)
    }
  }

  const mergedPlaces = Array.from(seenKeys.values())

  // Merge labeled places (deduplicate by name)
  const labeledMap = new Map<string, (typeof datasets)[0]['labeledPlaces'][0]>()
  for (const ds of datasets) {
    for (const lp of ds.labeledPlaces) {
      labeledMap.set(lp.name.toLowerCase(), lp)
    }
  }
  const mergedLabeled = Array.from(labeledMap.values())

  // Merge commute routes (deduplicate by id)
  const routeMap = new Map<string, (typeof datasets)[0]['commuteRoutes'][0]>()
  for (const ds of datasets) {
    for (const r of ds.commuteRoutes) {
      routeMap.set(r.id, r)
    }
  }
  const mergedRoutes = Array.from(routeMap.values())

  // Merge photos (deduplicate by id)
  const photoMap = new Map<string, (typeof datasets)[0]['photos'][0]>()
  for (const ds of datasets) {
    for (const ph of ds.photos) {
      photoMap.set(ph.id, ph)
    }
  }
  const mergedPhotos = Array.from(photoMap.values())

  // Derive metadata
  const lists = [...new Set(mergedPlaces.map(p => p.list))].sort()
  const countries = [...new Set(mergedPlaces.map(p => p.country).filter(Boolean))].sort()
  const cities = [...new Set(mergedPlaces.map(p => p.city).filter(c => c && c !== 'Unknown'))].sort()

  const dates = mergedPlaces.map(p => p.date).filter(Boolean) as string[]
  dates.sort()

  const stats = recomputeStats(mergedPlaces)
  stats.totalLabels = mergedLabeled.length
  stats.totalCommuteRoutes = mergedRoutes.length

  return {
    places: mergedPlaces,
    labeledPlaces: mergedLabeled,
    commuteRoutes: mergedRoutes,
    photos: mergedPhotos,
    lists,
    countries,
    cities,
    dateRange: {
      earliest: dates[0] || '',
      latest: dates[dates.length - 1] || '',
    },
    stats,
  }
}
