// Core data types for Google Maps Saved Places Analyzer

export interface Coordinates {
  lat: number
  lng: number
}

export interface Place {
  id: string
  name: string
  address: string
  coordinates: Coordinates
  country: string
  countryCode: string
  city: string
  list: string        // which list/category it belongs to
  date?: string       // ISO date when saved
  note?: string
  url?: string        // Google Maps URL
  rating?: number     // 1-5 star rating (for reviews)
  reviewText?: string // review content
  tags: string[]
  source: 'saved_places' | 'csv_list' | 'review' | 'labeled'
  category?: string   // inferred category (restaurant, cafe, museum, etc.)
}

export interface LabeledPlace {
  name: string        // label (Home, Work, friend name, etc.)
  address: string
  coordinates: Coordinates
}

export interface CommuteRoute {
  id: string
  travelMode: string
  origin?: Coordinates
  destination?: Coordinates
}

export interface ParsedData {
  places: Place[]
  labeledPlaces: LabeledPlace[]
  commuteRoutes: CommuteRoute[]
  photos: PhotoMeta[]       // parsed photo metadata from Google Photos takeout
  lists: string[]           // unique list names
  countries: string[]       // unique countries
  cities: string[]          // unique cities
  dateRange: { earliest: string; latest: string }
  stats: DataStats
}

export interface DataStats {
  totalPlaces: number
  totalReviews: number
  totalLists: number
  totalLabels: number
  totalCommuteRoutes: number
  averageRating: number
  placesByList: Record<string, number>
  placesByCountry: Record<string, number>
  placesByCity: Record<string, number>
  placesByMonth: Record<string, number>
}

export interface FilterState {
  search: string
  lists: string[]
  countries: string[]
  cities: string[]
  dateRange: { start?: string; end?: string }
  minRating?: number
  source?: Place['source'][]
}

export type ViewMode = 'map' | 'list' | 'analytics' | 'trips' | 'compare' | 'diary' | 'food' | 'itinerary' | 'quiz'

// --------------------------------------------------------------------------
// Photos
// --------------------------------------------------------------------------

/** Parsed metadata from a Google Photos sidecar JSON */
export interface PhotoMeta {
  /** Unique ID derived from filename + timestamp */
  id: string
  /** Original filename (e.g. "IMG_1234.jpg") */
  title: string
  /** ISO date when the photo was taken (from photoTakenTime) */
  takenAt?: string
  /** GPS coordinates extracted from geoData / geoDataExif */
  coordinates?: Coordinates
  /** Album name from the Takeout folder structure */
  album?: string
}
