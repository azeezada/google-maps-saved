/**
 * Distance from Home/Work Analysis
 *
 * Uses Haversine formula to compute great-circle distances between
 * saved places and labeled reference points (Home, Work, etc.).
 */

import type { Place, LabeledPlace } from './types'

// ------------------------------------------------------------------
// Haversine formula — returns distance in kilometres
// ------------------------------------------------------------------

const R = 6371 // Earth radius in km

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface DistanceResult {
  place: Place
  distanceKm: number
}

export interface DistanceBucket {
  label: string
  minKm: number
  maxKm: number
  count: number
}

export interface DistanceAnalysis {
  reference: LabeledPlace
  /** All places with valid coordinates, sorted by distance ascending */
  results: DistanceResult[]
  buckets: DistanceBucket[]
  avgDistanceKm: number
  medianDistanceKm: number
  minDistanceKm: number
  maxDistanceKm: number
}

// ------------------------------------------------------------------
// Bucket definitions
// ------------------------------------------------------------------

const BUCKETS: Omit<DistanceBucket, 'count'>[] = [
  { label: '< 1 km',    minKm: 0,    maxKm: 1    },
  { label: '1 – 5 km',  minKm: 1,    maxKm: 5    },
  { label: '5 – 25 km', minKm: 5,    maxKm: 25   },
  { label: '25 – 100 km', minKm: 25, maxKm: 100  },
  { label: '100 – 500 km', minKm: 100, maxKm: 500 },
  { label: '> 500 km',  minKm: 500,  maxKm: Infinity },
]

// ------------------------------------------------------------------
// Reference point detection
// ------------------------------------------------------------------

/**
 * Priority labels we treat as reference points.
 * Names are matched case-insensitively.
 */
const PRIORITY_LABELS = ['home', 'work', 'office', 'school', 'university']

function isPriorityLabel(name: string): boolean {
  const lower = name.toLowerCase()
  return PRIORITY_LABELS.some(l => lower.includes(l))
}

/**
 * Select which labeled places to use as reference points.
 * Returns priority labels first (Home, Work …), then the rest,
 * capped at 5 total to avoid clutter.
 */
export function selectReferencePoints(labeledPlaces: LabeledPlace[]): LabeledPlace[] {
  const valid = labeledPlaces.filter(
    lp =>
      (lp.coordinates.lat !== 0 || lp.coordinates.lng !== 0) &&
      lp.name.trim().length > 0,
  )
  const priority = valid.filter(lp => isPriorityLabel(lp.name))
  const rest = valid.filter(lp => !isPriorityLabel(lp.name))
  return [...priority, ...rest].slice(0, 5)
}

// ------------------------------------------------------------------
// Main analysis function
// ------------------------------------------------------------------

export function analyzeDistances(
  places: Place[],
  labeledPlaces: LabeledPlace[],
): DistanceAnalysis[] {
  const refs = selectReferencePoints(labeledPlaces)
  if (refs.length === 0) return []

  const validPlaces = places.filter(
    p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0,
  )

  return refs.map(ref => {
    const results: DistanceResult[] = validPlaces
      .map(place => ({
        place,
        distanceKm: haversineKm(
          ref.coordinates.lat,
          ref.coordinates.lng,
          place.coordinates.lat,
          place.coordinates.lng,
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)

    const buckets: DistanceBucket[] = BUCKETS.map(b => ({
      ...b,
      count: results.filter(r => r.distanceKm >= b.minKm && r.distanceKm < b.maxKm).length,
    }))

    const n = results.length
    const avgDistanceKm =
      n > 0 ? results.reduce((s, r) => s + r.distanceKm, 0) / n : 0

    const sorted = [...results].sort((a, b) => a.distanceKm - b.distanceKm)
    const medianDistanceKm =
      n === 0
        ? 0
        : n % 2 === 1
        ? sorted[Math.floor(n / 2)].distanceKm
        : (sorted[n / 2 - 1].distanceKm + sorted[n / 2].distanceKm) / 2

    return {
      reference: ref,
      results,
      buckets,
      avgDistanceKm: Math.round(avgDistanceKm * 10) / 10,
      medianDistanceKm: Math.round(medianDistanceKm * 10) / 10,
      minDistanceKm: n > 0 ? Math.round(results[0].distanceKm * 10) / 10 : 0,
      maxDistanceKm:
        n > 0 ? Math.round(results[results.length - 1].distanceKm * 10) / 10 : 0,
    }
  })
}
