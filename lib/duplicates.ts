/**
 * Duplicate detection
 *
 * Finds places that appear in multiple lists (same name + approximate coordinates).
 * Provides a way to identify and analyze cross-list overlaps.
 */

import type { Place } from './types'

export interface DuplicateGroup {
  /** Canonical name of the place */
  name: string
  /** All lists this place appears in */
  lists: string[]
  /** All instances of this place */
  places: Place[]
  /** Coordinates (from first instance with valid coords) */
  coordinates: { lat: number; lng: number }
}

/**
 * Build a normalized key for deduplication.
 * Uses rounded coords (4 decimal places) + lowercase name.
 */
function normalizeKey(p: Place): string {
  if (p.coordinates.lat !== 0 || p.coordinates.lng !== 0) {
    return `${p.coordinates.lat.toFixed(4)},${p.coordinates.lng.toFixed(4)}:${p.name.toLowerCase().trim()}`
  }
  return `nocoord:${p.name.toLowerCase().trim()}`
}

/**
 * Find places that are saved in multiple lists.
 * Returns groups where a place appears in 2+ different lists.
 */
export function findDuplicates(places: Place[]): DuplicateGroup[] {
  const groups = new Map<string, Place[]>()

  for (const p of places) {
    const key = normalizeKey(p)
    const existing = groups.get(key) || []
    existing.push(p)
    groups.set(key, existing)
  }

  const duplicates: DuplicateGroup[] = []

  for (const [, group] of groups) {
    const uniqueLists = [...new Set(group.map(p => p.list))]
    if (uniqueLists.length < 2) continue

    const withCoords = group.find(p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0)
    duplicates.push({
      name: group[0].name,
      lists: uniqueLists.sort(),
      places: group,
      coordinates: withCoords?.coordinates || group[0].coordinates,
    })
  }

  return duplicates.sort((a, b) => b.lists.length - a.lists.length)
}
