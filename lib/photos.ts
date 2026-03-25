/**
 * Google Photos Takeout — Photo metadata parsing and matching.
 *
 * Google Photos takeout structure:
 *   Takeout/Google Photos/<Album Name>/<photo.jpg>.json  ← sidecar metadata
 *   Takeout/Google Photos/<Album Name>/<photo.jpg>       ← actual image (optional)
 *
 * Sidecar JSON schema (relevant fields):
 * {
 *   "title": "IMG_1234.jpg",
 *   "photoTakenTime": { "timestamp": "1234567890", "formatted": "..." },
 *   "creationTime":   { "timestamp": "1234567890", "formatted": "..." },
 *   "geoData":     { "latitude": 40.7, "longitude": -73.9, "altitude": 0, ... },
 *   "geoDataExif": { "latitude": 40.7, "longitude": -73.9, "altitude": 0, ... }
 * }
 */

import type { Coordinates, Place, PhotoMeta } from './types'
import { haversineKm } from './distances'

// Re-export for consumers
export type { PhotoMeta }

// ------------------------------------------------------------------
// Parsing
// ------------------------------------------------------------------

/**
 * Parse a single Google Photos sidecar JSON object into a PhotoMeta.
 * Returns null if the sidecar has no usable title or GPS data.
 */
export function parsePhotoSidecar(
  data: unknown,
  album?: string,
): PhotoMeta | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  const title =
    (typeof d.title === 'string' && d.title) ||
    (typeof d.filename === 'string' && d.filename) ||
    ''
  if (!title) return null

  // Timestamp: prefer photoTakenTime, fall back to creationTime
  let takenAt: string | undefined
  const tsRaw =
    (d.photoTakenTime as Record<string, unknown> | undefined)?.timestamp ??
    (d.creationTime as Record<string, unknown> | undefined)?.timestamp
  if (tsRaw != null) {
    const ms = parseInt(String(tsRaw), 10) * 1000
    if (!Number.isNaN(ms)) takenAt = new Date(ms).toISOString()
  }

  // GPS: prefer geoData (Google computed), fall back to geoDataExif
  let coordinates: Coordinates | undefined
  for (const key of ['geoData', 'geoDataExif']) {
    const geo = d[key] as Record<string, unknown> | undefined
    if (!geo) continue
    const lat = typeof geo.latitude === 'number' ? geo.latitude : undefined
    const lng = typeof geo.longitude === 'number' ? geo.longitude : undefined
    if (lat != null && lng != null && (lat !== 0 || lng !== 0)) {
      coordinates = { lat, lng }
      break
    }
  }

  const id = `photo_${encodeURIComponent(title)}_${tsRaw ?? Math.random().toString(36).slice(2)}`

  return { id, title, takenAt, coordinates, album }
}

// ------------------------------------------------------------------
// Matching
// ------------------------------------------------------------------

/**
 * Match photos to places by proximity (Haversine distance).
 *
 * @param photos    All parsed PhotoMeta (may lack coordinates — those are skipped)
 * @param places    All places to match against
 * @param radiusKm  Match radius in kilometres (default 0.15 km = 150 m)
 * @returns         Map of placeId → PhotoMeta[] sorted by takenAt ascending
 */
export function matchPhotosToPlaces(
  photos: PhotoMeta[],
  places: Place[],
  radiusKm = 0.15,
): Map<string, PhotoMeta[]> {
  const result = new Map<string, PhotoMeta[]>()

  const validPlaces = places.filter(
    p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0,
  )
  const geoPhotos = photos.filter(p => p.coordinates != null)

  if (validPlaces.length === 0 || geoPhotos.length === 0) return result

  for (const place of validPlaces) {
    const nearby: PhotoMeta[] = []
    for (const photo of geoPhotos) {
      if (!photo.coordinates) continue
      const dist = haversineKm(
        place.coordinates.lat,
        place.coordinates.lng,
        photo.coordinates.lat,
        photo.coordinates.lng,
      )
      if (dist <= radiusKm) nearby.push(photo)
    }
    if (nearby.length > 0) {
      nearby.sort((a, b) => (a.takenAt ?? '').localeCompare(b.takenAt ?? ''))
      result.set(place.id, nearby)
    }
  }

  return result
}

// ------------------------------------------------------------------
// Stats helpers
// ------------------------------------------------------------------

/** Total number of places that have at least one matched photo */
export function countPlacesWithPhotos(photoMap: Map<string, PhotoMeta[]>): number {
  return photoMap.size
}

/** Total photo count across all matched places */
export function countAllMatchedPhotos(photoMap: Map<string, PhotoMeta[]>): number {
  let total = 0
  for (const photos of photoMap.values()) total += photos.length
  return total
}
