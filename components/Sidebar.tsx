'use client'

import { Search, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ParsedData, FilterState } from '@/lib/types'
import { getListCounts } from '@/lib/filters'

interface SidebarProps {
  data: ParsedData
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  filteredCount: number
  /** On mobile the sidebar is an overlay; this callback closes it */
  onClose?: () => void
  /** Whether the sidebar is in mobile-overlay mode */
  isMobileOverlay?: boolean
}

// Color palette for lists
const LIST_COLORS: Record<string, string> = {
  'Saved Places': '#3b82f6',
  'Reviews': '#f59e0b',
  'Favorite places': '#ef4444',
  'Want to go': '#10b981',
  'foodie': '#f97316',
  'cultura': '#8b5cf6',
  'night out': '#ec4899',
  'Default list': '#6b7280',
}

function getListColor(name: string): string {
  return LIST_COLORS[name] || `hsl(${Math.abs(hashCode(name)) % 360}, 60%, 55%)`
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

export function Sidebar({ data, filters, onFiltersChange, filteredCount, onClose, isMobileOverlay }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['lists', 'countries'])
  )

  const listCounts = getListCounts(data.places)

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections)
    if (next.has(section)) next.delete(section)
    else next.add(section)
    setExpandedSections(next)
  }

  const toggleListFilter = (list: string) => {
    const next = filters.lists.includes(list)
      ? filters.lists.filter(l => l !== list)
      : [...filters.lists, list]
    onFiltersChange({ ...filters, lists: next })
  }

  const toggleCountryFilter = (country: string) => {
    const next = filters.countries.includes(country)
      ? filters.countries.filter(c => c !== country)
      : [...filters.countries, country]
    onFiltersChange({ ...filters, countries: next })
  }

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      lists: [],
      countries: [],
      cities: [],
      dateRange: {},
    })
  }

  const hasActiveFilters = filters.search || filters.lists.length > 0 ||
    filters.countries.length > 0 || filters.cities.length > 0

  return (
    <aside
      data-testid="sidebar"
      className={`w-72 border-r border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden shrink-0 ${
        isMobileOverlay
          ? 'fixed inset-y-0 left-0 z-40 shadow-2xl'
          : ''
      }`}
    >
      {/* Mobile header row with close button */}
      {isMobileOverlay && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Filters
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--muted)] transition-colors"
            aria-label="Close filters"
          >
            <X className="w-4 h-4 text-[var(--muted-foreground)]" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search places..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full pl-8 pr-8 py-2 text-xs bg-[var(--muted)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="mt-2 text-xs text-[var(--primary)] hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Filter sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Lists */}
        <div className="border-b border-[var(--border)]">
          <button
            onClick={() => toggleSection('lists')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <span>Lists ({data.lists.length})</span>
            {expandedSections.has('lists') ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedSections.has('lists') && (
            <div className="px-2 pb-2 space-y-0.5">
              {data.lists.map(list => (
                <button
                  key={list}
                  onClick={() => toggleListFilter(list)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    filters.lists.length === 0 || filters.lists.includes(list)
                      ? 'text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)] opacity-50'
                  } hover:bg-[var(--muted)]`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getListColor(list) }}
                  />
                  <span className="truncate flex-1 text-left">{list}</span>
                  <span className="text-[var(--muted-foreground)] text-[10px]">
                    {listCounts[list] || 0}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Countries */}
        <div className="border-b border-[var(--border)]">
          <button
            onClick={() => toggleSection('countries')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <span>Countries ({data.countries.length})</span>
            {expandedSections.has('countries') ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedSections.has('countries') && (
            <div className="px-2 pb-2 space-y-0.5">
              {data.countries.map(country => (
                <button
                  key={country}
                  onClick={() => toggleCountryFilter(country)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    filters.countries.length === 0 || filters.countries.includes(country)
                      ? 'text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)] opacity-50'
                  } hover:bg-[var(--muted)]`}
                >
                  <span className="truncate flex-1 text-left">{country}</span>
                  <span className="text-[var(--muted-foreground)] text-[10px]">
                    {data.stats.placesByCountry[country] || 0}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats summary */}
        <div className="p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
            Summary
          </h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Total places</span>
              <span className="font-medium">{data.stats.totalPlaces}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Reviews</span>
              <span className="font-medium">{data.stats.totalReviews}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Labels</span>
              <span className="font-medium">{data.stats.totalLabels}</span>
            </div>
            {data.stats.averageRating > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Avg rating</span>
                <span className="font-medium">⭐ {data.stats.averageRating}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

export { getListColor }
