/**
 * Itinerary Builder — manage a multi-day itinerary built from saved places.
 *
 * Data is persisted to localStorage so the plan survives page refreshes.
 */

import type { Place } from './types'

export interface ItineraryDay {
  id: string          // "day_1", "day_2", …
  label: string       // "Day 1", user-editable title
  placeIds: string[]  // ordered list of place IDs
}

export interface Itinerary {
  id: string
  name: string
  createdAt: string   // ISO
  days: ItineraryDay[]
}

const STORAGE_KEY = 'gmsa-itinerary'

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

export function loadItinerary(): Itinerary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Itinerary
  } catch {
    return null
  }
}

export function saveItinerary(itinerary: Itinerary): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itinerary))
  } catch { /* ignore */ }
}

export function clearItinerary(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createItinerary(name: string, numDays: number = 3): Itinerary {
  const days: ItineraryDay[] = []
  for (let i = 1; i <= numDays; i++) {
    days.push({ id: `day_${i}`, label: `Day ${i}`, placeIds: [] })
  }
  return {
    id: `itin_${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    days,
  }
}

export function addDay(itinerary: Itinerary): Itinerary {
  const n = itinerary.days.length + 1
  return {
    ...itinerary,
    days: [
      ...itinerary.days,
      { id: `day_${n}_${Date.now()}`, label: `Day ${n}`, placeIds: [] },
    ],
  }
}

export function removeDay(itinerary: Itinerary, dayId: string): Itinerary {
  return {
    ...itinerary,
    days: itinerary.days.filter(d => d.id !== dayId),
  }
}

export function movePlaceToDay(
  itinerary: Itinerary,
  placeId: string,
  toDayId: string,
  toIndex?: number,
): Itinerary {
  // Remove from all days first
  const days = itinerary.days.map(d => ({
    ...d,
    placeIds: d.placeIds.filter(id => id !== placeId),
  }))

  // Add to target day
  return {
    ...itinerary,
    days: days.map(d => {
      if (d.id !== toDayId) return d
      const ids = [...d.placeIds]
      if (toIndex !== undefined && toIndex >= 0 && toIndex <= ids.length) {
        ids.splice(toIndex, 0, placeId)
      } else {
        ids.push(placeId)
      }
      return { ...d, placeIds: ids }
    }),
  }
}

export function removePlaceFromItinerary(itinerary: Itinerary, placeId: string): Itinerary {
  return {
    ...itinerary,
    days: itinerary.days.map(d => ({
      ...d,
      placeIds: d.placeIds.filter(id => id !== placeId),
    })),
  }
}

export function reorderPlaceWithinDay(
  itinerary: Itinerary,
  dayId: string,
  fromIndex: number,
  toIndex: number,
): Itinerary {
  return {
    ...itinerary,
    days: itinerary.days.map(d => {
      if (d.id !== dayId) return d
      const ids = [...d.placeIds]
      const [item] = ids.splice(fromIndex, 1)
      ids.splice(toIndex, 0, item)
      return { ...d, placeIds: ids }
    }),
  }
}

export function renameDayLabel(itinerary: Itinerary, dayId: string, label: string): Itinerary {
  return {
    ...itinerary,
    days: itinerary.days.map(d => d.id === dayId ? { ...d, label } : d),
  }
}

/** All place IDs already in any day */
export function scheduledPlaceIds(itinerary: Itinerary): Set<string> {
  const ids = new Set<string>()
  for (const d of itinerary.days) for (const id of d.placeIds) ids.add(id)
  return ids
}

/** Estimated time at a place (rough, minutes) based on category */
export function estimatedMinutes(category?: string): number {
  switch (category) {
    case 'restaurant': return 60
    case 'cafe': return 45
    case 'bar': return 60
    case 'museum': return 120
    case 'hotel': return 30
    case 'park': return 60
    case 'beach': return 120
    case 'attraction': return 90
    case 'shop': return 45
    case 'gym': return 90
    default: return 30
  }
}

/** Format total minutes as "Xh Ym" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/** Build a shareable text summary of the itinerary */
export function itineraryToText(itinerary: Itinerary, placeMap: Map<string, Place>): string {
  const lines: string[] = [`📅 ${itinerary.name}`, '']
  for (const day of itinerary.days) {
    lines.push(`## ${day.label}`)
    if (day.placeIds.length === 0) {
      lines.push('  (no places yet)')
    } else {
      for (const id of day.placeIds) {
        const p = placeMap.get(id)
        if (p) {
          lines.push(`  • ${p.name}${p.address ? ` — ${p.address}` : ''}`)
        }
      }
    }
    lines.push('')
  }
  return lines.join('\n')
}
