/**
 * Trip Detection — clusters places saved close together in time + location.
 *
 * Algorithm:
 *  1. Filter places with both a date and valid coordinates.
 *  2. Sort by date ascending.
 *  3. Greedy single-pass cluster:
 *     - For each place, check all open trips.
 *     - A place can join a trip if:
 *         • It was saved within MAX_DAYS_GAP of the most-recent place in that trip.
 *         • Its coordinates are within MAX_KM_RADIUS of the trip's centroid.
 *     - Join the best-matching open trip (smallest distance to centroid), or start a new one.
 *  4. After all places are assigned, close trips that have been idle > MAX_DAYS_GAP.
 *  5. Discard trips with fewer than MIN_PLACES places.
 *  6. Name each trip after the dominant city (fallback: country).
 */

import type { Place } from './types'

/** Max calendar days between consecutive saves in the same trip */
const MAX_DAYS_GAP = 14

/** Max km from the trip's centroid for a new place to be admitted */
const MAX_KM_RADIUS = 250

/** Minimum number of places to form a trip */
const MIN_PLACES = 2

export interface Trip {
  id: string
  name: string            // "Trip to Tokyo", "Paris Exploration", etc.
  places: Place[]
  startDate: string       // ISO date of earliest place
  endDate: string         // ISO date of latest place
  centroid: { lat: number; lng: number }
  dominantCity: string
  dominantCountry: string
  durationDays: number
}

/** Haversine distance in km */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000,
  )
}

function centroidOf(places: Place[]): { lat: number; lng: number } {
  const valid = places.filter(p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0)
  if (valid.length === 0) return { lat: 0, lng: 0 }
  const lat = valid.reduce((s, p) => s + p.coordinates.lat, 0) / valid.length
  const lng = valid.reduce((s, p) => s + p.coordinates.lng, 0) / valid.length
  return { lat, lng }
}

/** Returns the most-frequent non-empty value in an array */
function mode(values: string[]): string {
  const counts: Record<string, number> = {}
  for (const v of values) if (v && v !== 'Unknown') counts[v] = (counts[v] || 0) + 1
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? ''
}

function tripName(city: string, country: string): string {
  if (city && city !== 'Unknown') return `Trip to ${city}`
  if (country && country !== 'Unknown') return `Trip to ${country}`
  return 'Unnamed Trip'
}

interface OpenTrip {
  places: Place[]
  lastDate: string
  centroid: { lat: number; lng: number }
}

export function detectTrips(places: Place[]): Trip[] {
  // Only consider places with a date and real coordinates
  const eligible = places.filter(
    p => p.date && (p.coordinates.lat !== 0 || p.coordinates.lng !== 0),
  )

  // Sort by date ascending
  eligible.sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0))

  const openTrips: OpenTrip[] = []

  for (const place of eligible) {
    const date = place.date!
    const { lat, lng } = place.coordinates

    // Find the best matching open trip
    let bestTrip: OpenTrip | null = null
    let bestDist = Infinity

    for (const trip of openTrips) {
      const dayGap = daysBetween(trip.lastDate, date)
      if (dayGap > MAX_DAYS_GAP) continue

      const dist = haversineKm(trip.centroid.lat, trip.centroid.lng, lat, lng)
      if (dist <= MAX_KM_RADIUS && dist < bestDist) {
        bestDist = dist
        bestTrip = trip
      }
    }

    if (bestTrip) {
      bestTrip.places.push(place)
      bestTrip.lastDate = date
      bestTrip.centroid = centroidOf(bestTrip.places)
    } else {
      openTrips.push({
        places: [place],
        lastDate: date,
        centroid: { lat, lng },
      })
    }
  }

  // Build Trip objects, filter by min size
  const trips: Trip[] = []
  let idx = 0
  for (const t of openTrips) {
    if (t.places.length < MIN_PLACES) continue

    const sortedDates = t.places.map(p => p.date!).sort()
    const startDate = sortedDates[0]
    const endDate = sortedDates[sortedDates.length - 1]
    const durationDays = Math.max(1, Math.ceil(daysBetween(startDate, endDate)) + 1)

    const dominantCity = mode(t.places.map(p => p.city))
    const dominantCountry = mode(t.places.map(p => p.country))

    trips.push({
      id: `trip_${idx++}`,
      name: tripName(dominantCity, dominantCountry),
      places: t.places,
      startDate,
      endDate,
      centroid: centroidOf(t.places),
      dominantCity,
      dominantCountry,
      durationDays,
    })
  }

  // Sort trips chronologically (newest first)
  trips.sort((a, b) => (a.startDate > b.startDate ? -1 : 1))

  return trips
}
