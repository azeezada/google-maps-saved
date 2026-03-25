'use client'

import { useMemo, useState } from 'react'
import { Star, ExternalLink, Map } from 'lucide-react'
import type { Place } from '@/lib/types'
import { getCategoryInfo } from '@/lib/categories'
import type { PlaceCategory } from '@/lib/categories'

const FOOD_CATEGORIES = new Set([
  'restaurant', 'cafe', 'bar', 'bakery',
])

interface FoodMapViewProps {
  places: Place[]
  onSelectPlace?: (place: Place) => void
  onViewOnMap?: (place: Place) => void
}

type SortBy = 'name' | 'rating' | 'city' | 'category'

export function FoodMapView({ places, onSelectPlace, onViewOnMap }: FoodMapViewProps) {
  const [sortBy, setSortBy] = useState<SortBy>('rating')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const foodPlaces = useMemo(() => {
    return places.filter(p => {
      if (!p.category) return false
      return FOOD_CATEGORIES.has(p.category)
    })
  }, [places])

  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of foodPlaces) {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [foodPlaces])

  const filtered = useMemo(() => {
    let result = filterCategory === 'all' ? foodPlaces : foodPlaces.filter(p => p.category === filterCategory)

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0)
        case 'name': return a.name.localeCompare(b.name)
        case 'city': return (a.city || '').localeCompare(b.city || '')
        case 'category': return (a.category || '').localeCompare(b.category || '')
        default: return 0
      }
    })

    return result
  }, [foodPlaces, filterCategory, sortBy])

  const avgRating = useMemo(() => {
    const rated = filtered.filter(p => p.rating)
    if (rated.length === 0) return 0
    return rated.reduce((s, p) => s + p.rating!, 0) / rated.length
  }, [filtered])

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filtered) {
      if (p.city && p.city !== 'Unknown') counts[p.city] = (counts[p.city] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [filtered])

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="food-map-view">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-4 flex-wrap">
        <span className="text-xl">🍽️</span>
        <h2 className="text-sm font-semibold">My Food Map</h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {filtered.length} food place{filtered.length !== 1 ? 's' : ''}
        </span>

        {/* Category filter */}
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setFilterCategory('all')}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              filterCategory === 'all'
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
            data-testid="food-filter-all"
          >
            All
          </button>
          {categoryBreakdown.map(([cat, count]) => {
            const info = getCategoryInfo(cat as PlaceCategory)
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                  filterCategory === cat
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
                data-testid={`food-filter-${cat}`}
              >
                {info.emoji} {info.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {foodPlaces.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <span className="text-5xl">🍽️</span>
          <h2 className="text-lg font-semibold">No Food Places Found</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
            No restaurants, cafes, bars, or bakeries detected in your saved places. Try uploading more data.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Stats sidebar */}
          <aside className="w-56 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Total Food Places</p>
              <p className="text-xl font-bold">{filtered.length}</p>
            </div>
            {avgRating > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Avg Rating</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  {avgRating.toFixed(1)}
                </p>
              </div>
            )}
            {cityCounts.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Top Cities</p>
                {cityCounts.map(([city, count]) => (
                  <div key={city} className="flex items-center justify-between text-xs py-1">
                    <span className="truncate">{city}</span>
                    <span className="font-mono text-[var(--muted-foreground)]">{count}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Sort by</p>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className="w-full text-xs bg-[var(--muted)] border border-[var(--border)] rounded-lg px-2 py-1.5"
                aria-label="Sort food places by"
              >
                <option value="rating">Rating (high to low)</option>
                <option value="name">Name (A-Z)</option>
                <option value="city">City (A-Z)</option>
                <option value="category">Category</option>
              </select>
            </div>
          </aside>

          {/* Place list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map(place => (
              <div
                key={place.id}
                data-testid="food-place-row"
                onClick={() => onSelectPlace?.(place)}
                className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
              >
                <span className="text-lg shrink-0">
                  {place.category ? getCategoryInfo(place.category as PlaceCategory).emoji : '🍽️'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{place.name}</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {[place.city, place.country].filter(Boolean).join(', ')}
                  </p>
                </div>
                {place.rating && (
                  <span className="flex items-center gap-0.5 text-xs shrink-0">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    {place.rating}
                  </span>
                )}
                <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
                  {place.category ? getCategoryInfo(place.category as PlaceCategory).label : ''}
                </span>
                {place.coordinates.lat !== 0 && onViewOnMap && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewOnMap(place) }}
                    className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors shrink-0"
                    title="View on map"
                  >
                    <Map className="w-3.5 h-3.5" />
                  </button>
                )}
                {place.url && (
                  <a
                    href={place.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--muted-foreground)] hover:text-[var(--primary)] shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
