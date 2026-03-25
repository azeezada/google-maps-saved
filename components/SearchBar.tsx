'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, X, MapPin, Star, List, Navigation } from 'lucide-react'
import type { Place, FilterState, ParsedData } from '@/lib/types'
import { getListColor } from './Sidebar'

interface SearchBarProps {
  data: ParsedData
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onPlaceSelect: (place: Place) => void
  /** Increment this to imperatively focus the search input */
  focusTrigger?: number
}

/**
 * Google Maps-style floating search bar.
 * Searches across: name, address, city, country, list name, notes, review text.
 * Shows categorized results as you type.
 */
export function SearchBar({ data, filters, onFiltersChange, onPlaceSelect, focusTrigger }: SearchBarProps) {
  const [query, setQuery] = useState(filters.search)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard shortcut: Cmd+K or / (only within this component's own listener)
  // Global Cmd+K is handled in page.tsx to also switch view modes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !focused && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        inputRef.current?.focus()
        setFocused(true)
      }
      if (e.key === 'Escape') {
        setFocused(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [focused])

  // External focus trigger (e.g. from global Cmd+K handler in page.tsx)
  useEffect(() => {
    if (focusTrigger && focusTrigger > 0) {
      inputRef.current?.focus()
      setFocused(true)
    }
  }, [focusTrigger])

  // Compute search results with categories
  const results = useMemo(() => {
    if (!query || query.length < 2) return null

    const q = query.toLowerCase()
    const matched: Place[] = []
    const matchedLists: string[] = []
    const matchedCities: string[] = []

    // Search places
    for (const place of data.places) {
      const fields = [
        place.name,
        place.address,
        place.city,
        place.country,
        place.list,
        place.note,
        place.reviewText,
        ...place.tags,
      ].filter(Boolean).join(' ').toLowerCase()

      if (fields.includes(q)) {
        matched.push(place)
      }
    }

    // Search list names
    for (const list of data.lists) {
      if (list.toLowerCase().includes(q)) {
        matchedLists.push(list)
      }
    }

    // Search cities
    for (const city of data.cities) {
      if (city.toLowerCase().includes(q)) {
        matchedCities.push(city)
      }
    }

    return {
      places: matched.slice(0, 8),
      lists: matchedLists.slice(0, 4),
      cities: matchedCities.slice(0, 4),
      totalMatches: matched.length,
    }
  }, [query, data])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFiltersChange({ ...filters, search: query })
    setFocused(false)
  }

  const handleClear = () => {
    setQuery('')
    onFiltersChange({ ...filters, search: '' })
    inputRef.current?.focus()
  }

  const handlePlaceClick = (place: Place) => {
    onPlaceSelect(place)
    setFocused(false)
  }

  const handleListClick = (list: string) => {
    onFiltersChange({ ...filters, lists: [list], search: '' })
    setQuery('')
    setFocused(false)
  }

  const handleCityClick = (city: string) => {
    onFiltersChange({ ...filters, cities: [city], search: '' })
    setQuery('')
    setFocused(false)
  }

  const showDropdown = focused && results && (
    results.places.length > 0 || results.lists.length > 0 || results.cities.length > 0
  )

  return (
    <div ref={containerRef} className="absolute top-3 left-3 z-[1000] w-80">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search places, cities, lists..."
            value={query}
            data-testid="map-search-input"
            onChange={(e) => {
              setQuery(e.target.value)
              setFocused(true)
            }}
            onFocus={() => setFocused(true)}
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" />
            </button>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              ⌘K
            </kbd>
          )}
        </div>
      </form>

      {/* Dropdown results */}
      {showDropdown && (
        <div className="mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
          {/* Places */}
          {results.places.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]">
                Places ({results.totalMatches})
              </div>
              {results.places.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handlePlaceClick(place)}
                  className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-[var(--muted)] transition-colors text-left"
                >
                  <MapPin className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{place.name}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {place.address || place.city || place.list}
                    </p>
                  </div>
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: getListColor(place.list) }}
                  />
                </button>
              ))}
              {results.totalMatches > 8 && (
                <button
                  onClick={handleSubmit}
                  className="w-full px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--muted)] text-center"
                >
                  Show all {results.totalMatches} results →
                </button>
              )}
            </div>
          )}

          {/* Lists */}
          {results.lists.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]">
                Lists
              </div>
              {results.lists.map((list) => (
                <button
                  key={list}
                  onClick={() => handleListClick(list)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--muted)] transition-colors text-left"
                >
                  <List className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <span className="text-xs">{list}</span>
                  <span
                    className="w-2 h-2 rounded-full ml-auto"
                    style={{ backgroundColor: getListColor(list) }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Cities */}
          {results.cities.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]">
                Cities
              </div>
              {results.cities.map((city) => (
                <button
                  key={city}
                  onClick={() => handleCityClick(city)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--muted)] transition-colors text-left"
                >
                  <Navigation className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <span className="text-xs">{city}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
