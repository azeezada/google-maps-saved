/**
 * Google Takeout Data Parser
 * 
 * Parses multiple data formats from Google Takeout:
 * - Saved Places.json (GeoJSON)
 * - Reviews.json (GeoJSON)  
 * - *.csv list files
 * - Labeled places.json (GeoJSON)
 * - Commute routes.json
 */

import type { Place, LabeledPlace, CommuteRoute, ParsedData, DataStats, Coordinates, PhotoMeta } from './types'
import { inferCategory } from './categories'
import { parsePhotoSidecar } from './photos'
import { sanitizeString, sanitizeLat, sanitizeLng, sanitizeRating, sanitizeDate, sanitizeUrl, sanitizeTags } from './sanitize'
import { perfMark, perfMeasure } from './perf'

let idCounter = 0
function generateId(): string {
  return `place_${++idCounter}`
}

/**
 * Extract city from an address string.
 * Handles formats like "123 Main St, New York, NY 10001, United States"
 */
function extractCity(address: string): string {
  if (!address) return 'Unknown'
  const parts = address.split(',').map(p => p.trim())
  // City is usually the second-to-last or third-to-last part
  if (parts.length >= 3) {
    // Check if second-to-last has state abbreviation
    const secondLast = parts[parts.length - 2]
    if (/^[A-Z]{2}\s+\d{5}/.test(secondLast)) {
      // "NY 10001" pattern → city is before this
      return parts[parts.length - 3] || 'Unknown'
    }
    // Otherwise try the part before country
    return parts[parts.length - 3] || parts[parts.length - 2] || 'Unknown'
  }
  return parts[0] || 'Unknown'
}

/**
 * Extract country from address string
 */
function extractCountry(address: string, countryCode?: string): string {
  if (countryCode) {
    const map: Record<string, string> = {
      'US': 'United States', 'JP': 'Japan', 'GB': 'United Kingdom',
      'FR': 'France', 'DE': 'Germany', 'IT': 'Italy', 'ES': 'Spain',
      'CA': 'Canada', 'AU': 'Australia', 'MX': 'Mexico', 'SN': 'Senegal',
      'DC': 'United States',
    }
    return map[countryCode] || countryCode
  }
  if (!address) return 'Unknown'
  const parts = address.split(',').map(p => p.trim())
  return parts[parts.length - 1] || 'Unknown'
}

/**
 * Parse Saved Places GeoJSON
 */
export function parseSavedPlaces(data: any): Place[] {
  const features = data?.features || []
  return features.map((f: any) => {
    const props = f.properties || {}
    const loc = props.location || {}
    const coords = f.geometry?.coordinates || [0, 0]
    
    const name = sanitizeString(loc.name || 'Unknown Place')
    const address = sanitizeString(loc.address || '')
    return {
      id: generateId(),
      name,
      address,
      coordinates: { lng: sanitizeLng(coords[0]), lat: sanitizeLat(coords[1]) },
      country: sanitizeString(extractCountry(address, loc.country_code)),
      countryCode: sanitizeString(loc.country_code || ''),
      city: sanitizeString(extractCity(address)),
      list: 'Saved Places',
      date: sanitizeDate(props.date),
      note: sanitizeString(props.comment || ''),
      url: sanitizeUrl(props.google_maps_url),
      tags: [],
      source: 'saved_places' as const,
      category: inferCategory(name, address, 'Saved Places'),
    }
  })
}

/**
 * Parse Reviews GeoJSON
 */
export function parseReviews(data: any): Place[] {
  const features = data?.features || []
  return features.map((f: any) => {
    const props = f.properties || {}
    const loc = props.location || {}
    const coords = f.geometry?.coordinates || [0, 0]

    const name = sanitizeString(loc.name || 'Unknown Place')
    const address = sanitizeString(loc.address || '')
    return {
      id: generateId(),
      name,
      address,
      coordinates: { lng: sanitizeLng(coords[0]), lat: sanitizeLat(coords[1]) },
      country: sanitizeString(extractCountry(address, loc.country_code)),
      countryCode: sanitizeString(loc.country_code || ''),
      city: sanitizeString(extractCity(address)),
      list: 'Reviews',
      date: sanitizeDate(props.date),
      rating: sanitizeRating(props.five_star_rating_published),
      reviewText: sanitizeString(props.review_text || ''),
      url: sanitizeUrl(props.google_maps_url),
      tags: ['reviewed'],
      source: 'review' as const,
      category: inferCategory(name, address, 'Reviews'),
    }
  })
}

/**
 * Parse a CSV list file from Google Saved
 * Format: Title,Note,URL,Tags,Comment
 */
export function parseCSVList(csvText: string, listName: string): Place[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  
  // Skip header and empty rows
  const places: Place[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line === ',,,,') continue
    
    // Simple CSV parsing (handles basic cases)
    const parts = parseCSVLine(line)
    const [title, note, url, tags, comment] = parts
    
    if (!title && !url) continue
    
    const name = sanitizeString(title || extractNameFromURL(url))
    places.push({
      id: generateId(),
      name,
      address: '',
      coordinates: { lat: 0, lng: 0 }, // Will need geocoding
      country: '',
      countryCode: '',
      city: '',
      list: sanitizeString(listName),
      note: sanitizeString(note || comment || ''),
      url: sanitizeUrl(url),
      tags: sanitizeTags(tags ? tags.split(';').map(t => t.trim()).filter(Boolean) : []),
      source: 'csv_list' as const,
      category: inferCategory(name, '', listName),
    })
  }
  return places
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Extract place name from Google Maps URL
 */
function extractNameFromURL(url: string): string {
  if (!url) return 'Unknown Place'
  const match = url.match(/\/place\/([^/]+)/)
  if (match) {
    return decodeURIComponent(match[1].replace(/\+/g, ' '))
  }
  return 'Unknown Place'
}

/**
 * Parse Labeled Places GeoJSON
 */
export function parseLabeledPlaces(data: any): LabeledPlace[] {
  const features = data?.features || []
  return features.map((f: any) => {
    const props = f.properties || {}
    const coords = f.geometry?.coordinates || [0, 0]
    
    return {
      name: props.name || 'Unknown',
      address: props.address || '',
      coordinates: { lng: coords[0], lat: coords[1] },
    }
  })
}

/**
 * Parse Commute Routes JSON
 */
export function parseCommuteRoutes(data: any): CommuteRoute[] {
  const trips = data?.trips || []
  return trips.map((t: any) => {
    const placeVisits = t.place_visit || []
    const transitions = t.transition || []
    
    let destination: Coordinates | undefined
    for (const pv of placeVisits) {
      const ll = pv.place?.lat_lng
      if (ll) {
        destination = { lat: ll.latitude, lng: ll.longitude }
      }
    }
    
    let travelMode = 'Unknown'
    for (const tr of transitions) {
      if (tr.route?.travel_mode) {
        travelMode = tr.route.travel_mode
      }
    }
    
    return {
      id: t.id || generateId(),
      travelMode,
      destination,
    }
  })
}

/**
 * Compute statistics from parsed data
 */
function computeStats(places: Place[], reviews: Place[], labeledPlaces: LabeledPlace[], commuteRoutes: CommuteRoute[]): DataStats {
  const allPlaces = [...places, ...reviews]
  
  const placesByList: Record<string, number> = {}
  const placesByCountry: Record<string, number> = {}
  const placesByCity: Record<string, number> = {}
  const placesByMonth: Record<string, number> = {}
  
  for (const p of allPlaces) {
    placesByList[p.list] = (placesByList[p.list] || 0) + 1
    if (p.country) placesByCountry[p.country] = (placesByCountry[p.country] || 0) + 1
    if (p.city && p.city !== 'Unknown') placesByCity[p.city] = (placesByCity[p.city] || 0) + 1
    if (p.date) {
      const month = p.date.substring(0, 7) // YYYY-MM
      placesByMonth[month] = (placesByMonth[month] || 0) + 1
    }
  }
  
  const ratings = reviews.filter(r => r.rating).map(r => r.rating!)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  
  return {
    totalPlaces: allPlaces.length,
    totalReviews: reviews.length,
    totalLists: Object.keys(placesByList).length,
    totalLabels: labeledPlaces.length,
    totalCommuteRoutes: commuteRoutes.length,
    averageRating: Math.round(avgRating * 10) / 10,
    placesByList,
    placesByCountry,
    placesByCity,
    placesByMonth,
  }
}

/**
 * Parse all data from the extracted Takeout directory structure.
 * Expects data objects already loaded (not file paths).
 */
export function parseAllData(input: {
  savedPlacesJson?: any
  reviewsJson?: any
  labeledPlacesJson?: any
  commuteRoutesJson?: any
  csvLists?: { name: string; content: string }[]
}): ParsedData {
  perfMark('parseAllData-start')
  const savedPlaces = input.savedPlacesJson ? parseSavedPlaces(input.savedPlacesJson) : []
  const reviews = input.reviewsJson ? parseReviews(input.reviewsJson) : []
  const labeledPlaces = input.labeledPlacesJson ? parseLabeledPlaces(input.labeledPlacesJson) : []
  const commuteRoutes = input.commuteRoutesJson ? parseCommuteRoutes(input.commuteRoutesJson) : []
  
  const csvPlaces: Place[] = []
  for (const csv of input.csvLists || []) {
    const listName = csv.name.replace('.csv', '').replace(/\(\d+\)$/, '').trim()
    csvPlaces.push(...parseCSVList(csv.content, listName))
  }
  
  const allPlaces = [...savedPlaces, ...reviews, ...csvPlaces]
  
  // Compute unique values
  const lists = [...new Set(allPlaces.map(p => p.list))].sort()
  const countries = [...new Set(allPlaces.map(p => p.country).filter(Boolean))].sort()
  const cities = [...new Set(allPlaces.map(p => p.city).filter(c => c && c !== 'Unknown'))].sort()
  
  const dates = allPlaces.map(p => p.date).filter(Boolean) as string[]
  dates.sort()
  const dateRange = {
    earliest: dates[0] || '',
    latest: dates[dates.length - 1] || '',
  }
  
  const stats = computeStats(savedPlaces.concat(csvPlaces), reviews, labeledPlaces, commuteRoutes)

  perfMark('parseAllData-end')
  perfMeasure('parseAllData', 'parseAllData-start', 'parseAllData-end')

  return {
    places: allPlaces,
    labeledPlaces,
    commuteRoutes,
    photos: [],
    lists,
    countries,
    cities,
    dateRange,
    stats,
  }
}
