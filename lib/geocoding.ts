/**
 * Client-side geocoding for CSV places that lack coordinates.
 *
 * Strategy (in order):
 *  1. Extract @lat,lng from the Google Maps URL (zero network cost)
 *  2. Check localStorage cache
 *  3. Nominatim reverse lookup by place name (free, no API key, CORS-enabled)
 *     – Rate-limited to 1 request per second as required by Nominatim ToS
 *
 * Privacy: only place names/URLs leave the browser (to nominatim.openstreetmap.org).
 * No full takeout data is ever sent.
 */

const CACHE_KEY = 'gmsa_geocoding_cache_v1'
const RATE_LIMIT_MS = 1150 // slightly over 1 s to be safe

export interface GeoCoords {
  lat: number
  lng: number
}

interface CacheEntry {
  coords: GeoCoords | null
  timestamp: number
}

type GeoCache = Record<string, CacheEntry>

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function loadCache(): GeoCache {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as GeoCache) : {}
  } catch {
    return {}
  }
}

function saveCache(cache: GeoCache): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore quota errors — cache is best-effort
  }
}

/** Purge cache entries older than 30 days */
export function pruneStaleCacheEntries(): void {
  const cache = loadCache()
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  let changed = false
  for (const key of Object.keys(cache)) {
    if (cache[key].timestamp < cutoff) {
      delete cache[key]
      changed = true
    }
  }
  if (changed) saveCache(cache)
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------

/**
 * Try to pull lat/lng from a Google Maps URL.
 *
 * Handles the common `/@lat,lng,zoom` format. The short-link / `data=` formats
 * do NOT embed coordinates, so those fall through to Nominatim.
 */
export function extractCoordsFromURL(url: string): GeoCoords | null {
  if (!url) return null
  // Example: https://www.google.com/maps/place/Name/@40.7128,-74.0060,17z/…
  const m = url.match(/@(-?\d{1,3}\.?\d*),(-?\d{1,3}\.?\d*)/)
  if (m) {
    const lat = parseFloat(m[1])
    const lng = parseFloat(m[2])
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Nominatim lookup
// ---------------------------------------------------------------------------

async function nominatimLookup(query: string): Promise<GeoCoords | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=json&limit=1&addressdetails=0`
  try {
    const res = await fetch(url, {
      headers: {
        // Required by Nominatim usage policy
        'User-Agent': 'GoogleMapsSavedPlacesAnalyzer/1.0 (https://saved-places-search.pages.dev)',
      },
    })
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch {
    // Network error or parse failure — silently skip
  }
  return null
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface GeocodingProgress {
  total: number
  completed: number
  failed: number
  isRunning: boolean
}

export type GeoResultCallback = (
  placeId: string,
  coords: GeoCoords | null,
) => void

export type GeoProgressCallback = (progress: GeocodingProgress) => void

export interface GeocodingItem {
  id: string
  name: string
  url?: string
}

/**
 * Start a background geocoding queue. Returns a cancel function.
 *
 * Order of resolution per place:
 *  1. Extract from URL (instant)
 *  2. localStorage cache hit (instant)
 *  3. Nominatim network request (rate-limited)
 */
export function startGeocodingQueue(
  items: GeocodingItem[],
  onResult: GeoResultCallback,
  onProgress: GeoProgressCallback,
): () => void {
  let cancelled = false
  let completed = 0
  let failed = 0
  const total = items.length

  if (total === 0) {
    onProgress({ total: 0, completed: 0, failed: 0, isRunning: false })
    return () => {}
  }

  const cache = loadCache()

  onProgress({ total, completed: 0, failed: 0, isRunning: true })

  async function run() {
    for (const item of items) {
      if (cancelled) break

      const cacheKey = item.name.toLowerCase().trim()

      // 1. Try URL extraction (free, instant)
      if (item.url) {
        const coords = extractCoordsFromURL(item.url)
        if (coords) {
          cache[cacheKey] = { coords, timestamp: Date.now() }
          // Don't persist URL-extracted results to avoid stale data — they're cheap
          onResult(item.id, coords)
          completed++
          onProgress({ total, completed, failed, isRunning: true })
          continue
        }
      }

      // 2. Cache hit (instant)
      if (cacheKey in cache) {
        const entry = cache[cacheKey]
        onResult(item.id, entry.coords)
        if (!entry.coords) failed++
        completed++
        onProgress({ total, completed, failed, isRunning: true })
        continue
      }

      // 3. Nominatim (rate-limited)
      await new Promise<void>(r => setTimeout(r, RATE_LIMIT_MS))
      if (cancelled) break

      const coords = await nominatimLookup(item.name)
      cache[cacheKey] = { coords, timestamp: Date.now() }
      saveCache(cache)

      onResult(item.id, coords)
      if (!coords) failed++
      completed++
      onProgress({ total, completed, failed, isRunning: !cancelled })
    }

    if (!cancelled) {
      onProgress({ total, completed, failed, isRunning: false })
    }
  }

  run().catch(console.error)
  return () => {
    cancelled = true
  }
}
