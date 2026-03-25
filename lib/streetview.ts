/**
 * Google Street View Static API utilities
 *
 * Requires a Google Maps API key with the Street View Static API enabled.
 * The key is stored in localStorage (client-side only, never sent to our server).
 *
 * Docs: https://developers.google.com/maps/documentation/streetview/overview
 */

export const STREETVIEW_KEY_STORAGE = 'places_analyzer_streetview_api_key'

/** Build a Street View Static API image URL */
export function getStreetViewUrl(
  lat: number,
  lng: number,
  apiKey: string,
  width = 400,
  height = 220,
  fov = 90,
  pitch = 0,
): string {
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${lat},${lng}`,
    fov: String(fov),
    pitch: String(pitch),
    return_error_code: 'true', // 404 when no panorama found instead of grey image
    key: apiKey,
  })
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`
}

/** Deep-link to Google Maps Street View at a lat/lng */
export function getStreetViewDeepLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
}

/** Read stored API key (returns null in SSR or when not set) */
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STREETVIEW_KEY_STORAGE) ?? null
}

/** Persist API key to localStorage */
export function storeApiKey(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STREETVIEW_KEY_STORAGE, key.trim())
}

/** Remove stored API key */
export function clearApiKey(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STREETVIEW_KEY_STORAGE)
}
