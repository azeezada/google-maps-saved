/**
 * Filter utilities for places data
 */

import type { Place, FilterState } from './types'

export const defaultFilters: FilterState = {
  search: '',
  lists: [],
  countries: [],
  cities: [],
  dateRange: {},
}

/**
 * Apply filters to a list of places
 */
export function filterPlaces(places: Place[], filters: FilterState): Place[] {
  return places.filter(place => {
    // Text search
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const searchable = [
        place.name,
        place.address,
        place.list,
        place.note,
        place.city,
        place.country,
        place.reviewText,
        ...place.tags,
      ].filter(Boolean).join(' ').toLowerCase()
      
      if (!searchable.includes(q)) return false
    }
    
    // List filter
    if (filters.lists.length > 0 && !filters.lists.includes(place.list)) {
      return false
    }
    
    // Country filter
    if (filters.countries.length > 0 && !filters.countries.includes(place.country)) {
      return false
    }
    
    // City filter
    if (filters.cities.length > 0 && !filters.cities.includes(place.city)) {
      return false
    }
    
    // Date range filter
    if (filters.dateRange.start && place.date && place.date < filters.dateRange.start) {
      return false
    }
    if (filters.dateRange.end && place.date && place.date > filters.dateRange.end) {
      return false
    }
    
    // Rating filter
    if (filters.minRating && (!place.rating || place.rating < filters.minRating)) {
      return false
    }
    
    // Source filter
    if (filters.source && filters.source.length > 0 && !filters.source.includes(place.source)) {
      return false
    }
    
    return true
  })
}

/**
 * Get the count of places matching each list
 */
export function getListCounts(places: Place[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of places) {
    counts[p.list] = (counts[p.list] || 0) + 1
  }
  return counts
}
