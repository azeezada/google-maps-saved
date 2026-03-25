/**
 * Neighborhood Analysis
 *
 * Clusters places into "neighborhoods" using:
 * 1. Postal code + city (preferred — precise, human-readable)
 * 2. Lat/lng grid cells (~2 km) as a fallback for places without parseable postal codes
 */

import type { Place } from './types'

export interface Neighborhood {
  id: string
  name: string                        // display label e.g. "New York 10001"
  city: string
  country: string
  count: number
  places: Place[]
  centroid: { lat: number; lng: number }
  byList: Record<string, number>
  topList: string
}

/** Grid cell size in degrees — ~2 km at mid-latitudes */
const GRID_DEG = 0.02

/**
 * Try to extract a postal / ZIP code from a free-text address string.
 * Handles US, UK, Japan, and generic 4–6 digit codes.
 */
function parsePostalCode(address: string): string | null {
  if (!address) return null

  // US: 5 digits, optionally followed by -4
  const usZip = address.match(/\b(\d{5})(?:-\d{4})?\b/)
  if (usZip) return usZip[1]

  // UK: e.g. "SW1A 2AA" or "EC1A 1BB"
  const ukPost = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)
  if (ukPost) return ukPost[1].replace(/\s+/, ' ').toUpperCase()

  // Japan / Korea: "150-0001"
  const jpPost = address.match(/\b(\d{3}-\d{4})\b/)
  if (jpPost) return jpPost[1]

  // Generic: 4–6 digit numeric postal codes (many EU/Asian countries)
  const generic = address.match(/\b(\d{4,6})\b/)
  if (generic) return generic[1]

  return null
}

/** Compute the most frequent value in an array, or undefined. */
function mostFrequent(values: string[]): string {
  const freq: Record<string, number> = {}
  for (const v of values) if (v && v !== 'Unknown') freq[v] = (freq[v] || 0) + 1
  return Object.entries(freq).sort(([, a], [, b]) => b - a)[0]?.[0] ?? ''
}

/**
 * Analyse an array of places and return them grouped into neighborhoods,
 * sorted by place count descending.
 */
export function analyzeNeighborhoods(places: Place[]): Neighborhood[] {
  // Only places with valid coordinates
  const valid = places.filter(p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0)

  const groups = new Map<string, Place[]>()

  for (const place of valid) {
    const postal = parsePostalCode(place.address)
    let key: string

    if (postal && place.city && place.city !== 'Unknown') {
      key = `postal::${place.city}::${postal}`
    } else {
      // Grid fallback
      const gLat = (Math.round(place.coordinates.lat / GRID_DEG) * GRID_DEG).toFixed(3)
      const gLng = (Math.round(place.coordinates.lng / GRID_DEG) * GRID_DEG).toFixed(3)
      key = `grid::${gLat}::${gLng}`
    }

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(place)
  }

  const neighborhoods: Neighborhood[] = []

  for (const [key, grpPlaces] of groups) {
    const lat = grpPlaces.reduce((s, p) => s + p.coordinates.lat, 0) / grpPlaces.length
    const lng = grpPlaces.reduce((s, p) => s + p.coordinates.lng, 0) / grpPlaces.length

    const byList: Record<string, number> = {}
    for (const p of grpPlaces) {
      byList[p.list] = (byList[p.list] || 0) + 1
    }
    const topList = Object.entries(byList).sort(([, a], [, b]) => b - a)[0]?.[0] ?? ''

    const city = mostFrequent(grpPlaces.map(p => p.city))
    const country = mostFrequent(grpPlaces.map(p => p.country))

    let name: string
    if (key.startsWith('postal::')) {
      const parts = key.split('::') // ['postal', city, postal]
      name = `${parts[1]} ${parts[2]}`
    } else {
      name = city ? `${city} area` : 'Unknown area'
    }

    neighborhoods.push({
      id: key,
      name,
      city,
      country,
      count: grpPlaces.length,
      places: grpPlaces,
      centroid: { lat, lng },
      byList,
      topList,
    })
  }

  return neighborhoods.sort((a, b) => b.count - a.count)
}
