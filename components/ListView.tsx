'use client'

import { useState } from 'react'
import { ExternalLink, Star, SortAsc, SortDesc, Download, FileJson, FileText, Map, CheckCircle2 } from 'lucide-react'
import type { Place } from '@/lib/types'
import { getListColor } from './Sidebar'
import { exportCsv, exportJson, exportFilename } from '@/lib/export'
import { getCategoryInfo } from '@/lib/categories'
import type { PlaceCategory } from '@/lib/categories'
import { StreetViewHoverPreview } from './StreetViewThumbnail'

interface ListViewProps {
  places: Place[]
  onSelectPlace?: (place: Place) => void
  /** Called when user wants to jump to this place on the map */
  onViewOnMap?: (place: Place) => void
  /** Set of visited place IDs */
  visited?: Set<string>
  /** Toggle visited status */
  onToggleVisited?: (placeId: string) => void
}

type SortField = 'name' | 'list' | 'date' | 'rating' | 'city'

export function ListView({ places, onSelectPlace, onViewOnMap, visited, onToggleVisited }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null)

  const sorted = [...places].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'name':
        cmp = a.name.localeCompare(b.name)
        break
      case 'list':
        cmp = a.list.localeCompare(b.list)
        break
      case 'date':
        cmp = (a.date || '').localeCompare(b.date || '')
        break
      case 'rating':
        cmp = (a.rating || 0) - (b.rating || 0)
        break
      case 'city':
        cmp = a.city.localeCompare(b.city)
        break
    }
    return sortAsc ? cmp : -cmp
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const SortIcon = sortAsc ? SortAsc : SortDesc

  const handleExportCsv = () => {
    exportCsv(sorted, exportFilename('places', 'csv'))
  }

  const handleExportJson = () => {
    exportJson(sorted, exportFilename('places', 'json'))
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Export toolbar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
        <span className="text-xs text-[var(--muted-foreground)] mr-auto">
          {sorted.length} place{sorted.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleExportCsv}
          disabled={sorted.length === 0}
          title="Export as CSV"
          data-testid="export-csv"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--primary)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileText className="w-3.5 h-3.5" />
          CSV
        </button>
        <button
          onClick={handleExportJson}
          disabled={sorted.length === 0}
          title="Export as JSON"
          data-testid="export-json"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--primary)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileJson className="w-3.5 h-3.5" />
          JSON
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_120px_100px_80px_64px] gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] shrink-0">
        <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-left hover:text-[var(--foreground)]">
          Place {sortField === 'name' && <SortIcon className="w-3 h-3" />}
        </button>
        <button onClick={() => toggleSort('list')} className="flex items-center gap-1 text-left hover:text-[var(--foreground)]">
          List {sortField === 'list' && <SortIcon className="w-3 h-3" />}
        </button>
        <button onClick={() => toggleSort('city')} className="flex items-center gap-1 text-left hover:text-[var(--foreground)]">
          City {sortField === 'city' && <SortIcon className="w-3 h-3" />}
        </button>
        <button onClick={() => toggleSort('date')} className="flex items-center gap-1 text-left hover:text-[var(--foreground)]">
          Date {sortField === 'date' && <SortIcon className="w-3 h-3" />}
        </button>
        <button onClick={() => toggleSort('rating')} className="flex items-center gap-1 text-left hover:text-[var(--foreground)]">
          Rating {sortField === 'rating' && <SortIcon className="w-3 h-3" />}
        </button>
        <span></span>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-[var(--muted-foreground)]">
            No places match your filters
          </div>
        ) : (
          sorted.map((place) => (
            <div
              key={place.id}
              data-testid="list-place-row"
              className="relative grid grid-cols-[1fr_120px_120px_100px_80px_64px] gap-2 px-4 py-2.5 border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors items-center cursor-pointer"
              onClick={() => onSelectPlace?.(place)}
              onMouseEnter={() => {
                if (place.coordinates.lat !== 0 && place.coordinates.lng !== 0) {
                  setHoveredPlaceId(place.id)
                }
              }}
              onMouseLeave={() => setHoveredPlaceId(null)}
            >
              {/* Street View hover preview */}
              <StreetViewHoverPreview
                lat={place.coordinates.lat}
                lng={place.coordinates.lng}
                name={place.name}
                visible={hoveredPlaceId === place.id}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getListColor(place.list) }}
                  />
                  <span className="text-xs font-medium truncate">{place.name}</span>
                  {place.category && place.category !== 'other' && (
                    <span
                      title={getCategoryInfo(place.category as PlaceCategory).label}
                      className="text-sm shrink-0"
                    >
                      {getCategoryInfo(place.category as PlaceCategory).emoji}
                    </span>
                  )}
                  {place.source === 'csv_list' &&
                    place.coordinates.lat === 0 &&
                    place.coordinates.lng === 0 && (
                      <span
                        title="Location not yet resolved — geocoding in progress"
                        className="text-[9px] px-1 py-px rounded bg-[var(--muted)] text-[var(--muted-foreground)] shrink-0"
                      >
                        no coords
                      </span>
                    )}
                </div>
                {place.address && (
                  <p className="text-[10px] text-[var(--muted-foreground)] truncate ml-4 mt-0.5">
                    {place.address}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-[var(--muted-foreground)] truncate">{place.list}</span>
              <span className="text-[10px] text-[var(--muted-foreground)] truncate">{place.city || '—'}</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {place.date ? new Date(place.date).toLocaleDateString() : '—'}
              </span>
              <span className="text-[10px]">
                {place.rating ? (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-[var(--accent)] fill-[var(--accent)]" />
                    {place.rating}
                  </span>
                ) : '—'}
              </span>
              <div className="flex items-center gap-1">
                {onToggleVisited && (
                  <button
                    data-testid="list-visited-toggle"
                    title={visited?.has(place.id) ? 'Mark as not visited' : 'Mark as visited'}
                    onClick={(e) => { e.stopPropagation(); onToggleVisited(place.id) }}
                    className={`transition-colors ${
                      visited?.has(place.id)
                        ? 'text-green-400 hover:text-green-300'
                        : 'text-[var(--muted-foreground)] hover:text-green-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {place.coordinates.lat !== 0 && place.coordinates.lng !== 0 && onViewOnMap && (
                  <button
                    data-testid="view-on-map-btn"
                    title="View on map"
                    onClick={(e) => { e.stopPropagation(); onViewOnMap(place) }}
                    className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                  >
                    <Map className="w-3.5 h-3.5" />
                  </button>
                )}
                {place.url && (
                  <a
                    href={place.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
