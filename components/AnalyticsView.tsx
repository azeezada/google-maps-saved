'use client'

import { useMemo, useState } from 'react'
import type { ParsedData, Place, PhotoMeta } from '@/lib/types'
import { getListColor } from './Sidebar'
import { analyzeNeighborhoods } from '@/lib/neighborhoods'
import type { Neighborhood } from '@/lib/neighborhoods'
import { analyzeDistances } from '@/lib/distances'
import type { DistanceAnalysis } from '@/lib/distances'
import { analyzeCategories } from '@/lib/categories'
import type { CategoryCount } from '@/lib/categories'
import { analyzeSaveFrequency } from '@/lib/saveFrequency'
import type { SaveFrequencyAnalysis } from '@/lib/saveFrequency'
import { generateSuggestions } from '@/lib/suggestions'
import type { Suggestion } from '@/lib/suggestions'
import { analyzeTimeOfDay } from '@/lib/timeOfDay'
import type { TimeOfDayAnalysis } from '@/lib/timeOfDay'
import { countPlacesWithPhotos, countAllMatchedPhotos } from '@/lib/photos'
import { withPerf } from '@/lib/perf'
import { analyzeRatings } from '@/lib/ratings'
import type { RatingInsights } from '@/lib/ratings'
import { findDuplicates } from '@/lib/duplicates'
import type { DuplicateGroup } from '@/lib/duplicates'

// ---------------------------------------------------------------------------
// Rating Insights Section (defined before AnalyticsView to avoid Turbopack hoisting issues)
// ---------------------------------------------------------------------------
function RatingInsightsSection({ insights }: { insights: RatingInsights }) {
  const tendencyLabel = insights.tendency === 'generous' ? 'Generous Rater' : insights.tendency === 'harsh' ? 'Tough Critic' : 'Balanced Rater'
  const tendencyColor = insights.tendency === 'generous' ? '#10b981' : insights.tendency === 'harsh' ? '#ef4444' : '#f59e0b'

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5" data-testid="rating-insights">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span>⭐</span> Rating Insights
      </h3>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
          <p className="text-lg font-bold">{insights.userAverage}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">Avg Rating</p>
        </div>
        <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
          <p className="text-lg font-bold">{insights.totalRated}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">Reviews</p>
        </div>
        <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
          <p className="text-lg font-bold">{insights.modeRating}★</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">Most Common</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: `${tendencyColor}20` }}>
          <p className="text-sm font-bold" style={{ color: tendencyColor }}>{tendencyLabel}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">Your Style</p>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="space-y-1.5 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Distribution</p>
        {[5, 4, 3, 2, 1].map(star => {
          const count = insights.distribution[star] || 0
          const pct = insights.totalRated > 0 ? (count / insights.totalRated) * 100 : 0
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs w-8 text-right">{star}★</span>
              <div className="flex-1 h-4 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: star >= 4 ? '#10b981' : star === 3 ? '#f59e0b' : '#ef4444' }}
                />
              </div>
              <span className="text-xs w-8 text-[var(--muted-foreground)]">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Category ratings */}
      {insights.byCategory.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Ratings by Category</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {insights.byCategory.slice(0, 6).map(c => (
              <div key={c.category} className="flex items-center gap-2 bg-[var(--muted)] rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-medium truncate flex-1">{c.category}</span>
                <span className="text-xs font-bold">{c.average}★</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">({c.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Duplicate Detection Section (defined before AnalyticsView to avoid Turbopack hoisting issues)
// ---------------------------------------------------------------------------
function DuplicateDetectionSection({ duplicates }: { duplicates: DuplicateGroup[] }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? duplicates : duplicates.slice(0, 5)

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5" data-testid="duplicate-detection">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span>🔄</span> Duplicate Detection
        <span className="text-[10px] bg-[var(--muted)] px-2 py-0.5 rounded-full text-[var(--muted-foreground)]">
          {duplicates.length} found
        </span>
      </h3>
      <p className="text-xs text-[var(--muted-foreground)] mb-3">
        Places saved in multiple lists:
      </p>

      <div className="space-y-2">
        {displayed.map((dup, i) => (
          <div key={i} className="flex items-center gap-3 bg-[var(--muted)] rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{dup.name}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {dup.lists.map(list => (
                  <span
                    key={list}
                    className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--border)]"
                    style={{ background: getListColor(list) + '20', color: getListColor(list) }}
                  >
                    {list}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
              {dup.places.length} entries
            </span>
          </div>
        ))}
      </div>

      {duplicates.length > 5 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 text-xs text-[var(--primary)] hover:underline"
        >
          {showAll ? 'Show less' : `Show all ${duplicates.length} duplicates`}
        </button>
      )}
    </div>
  )
}

interface AnalyticsViewProps {
  data: ParsedData
  filteredPlaces: Place[]
  photoMap?: Map<string, PhotoMeta[]>
}

export function AnalyticsView({ data, filteredPlaces, photoMap }: AnalyticsViewProps) {
  const analytics = useMemo(() => {
    // Places by list
    const byList: Record<string, number> = {}
    for (const p of filteredPlaces) {
      byList[p.list] = (byList[p.list] || 0) + 1
    }

    // Places by country
    const byCountry: Record<string, number> = {}
    for (const p of filteredPlaces) {
      if (p.country) byCountry[p.country] = (byCountry[p.country] || 0) + 1
    }

    // Places by city (top 15)
    const byCity: Record<string, number> = {}
    for (const p of filteredPlaces) {
      if (p.city && p.city !== 'Unknown') byCity[p.city] = (byCity[p.city] || 0) + 1
    }

    // Timeline (by month)
    const byMonth: Record<string, number> = {}
    for (const p of filteredPlaces) {
      if (p.date) {
        const month = p.date.substring(0, 7)
        byMonth[month] = (byMonth[month] || 0) + 1
      }
    }

    // Ratings distribution
    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const p of filteredPlaces) {
      if (p.rating) ratingDist[p.rating] = (ratingDist[p.rating] || 0) + 1
    }

    return { byList, byCountry, byCity, byMonth, ratingDist }
  }, [filteredPlaces])

  const neighborhoods = useMemo(() => withPerf('analyzeNeighborhoods', () => analyzeNeighborhoods(filteredPlaces)), [filteredPlaces])
  const categories = useMemo(() => withPerf('analyzeCategories', () => analyzeCategories(filteredPlaces)), [filteredPlaces])
  const saveFrequency = useMemo(() => withPerf('analyzeSaveFrequency', () => analyzeSaveFrequency(filteredPlaces)), [filteredPlaces])
  const distanceAnalyses = useMemo(
    () => analyzeDistances(filteredPlaces, data.labeledPlaces),
    [filteredPlaces, data.labeledPlaces],
  )
  const suggestionsResult = useMemo(() => generateSuggestions(filteredPlaces), [filteredPlaces])
  const timeOfDay = useMemo(() => analyzeTimeOfDay(filteredPlaces), [filteredPlaces])
  const ratingInsights = useMemo(() => analyzeRatings(filteredPlaces), [filteredPlaces])
  const duplicates = useMemo(() => findDuplicates(data.places), [data.places])
  const photoStats = useMemo(() => {
    if (!photoMap || photoMap.size === 0) return null
    // Album breakdown: count photos per album
    const albumCounts: Record<string, number> = {}
    for (const photos of photoMap.values()) {
      for (const photo of photos) {
        const album = photo.album ?? '(No Album)'
        albumCounts[album] = (albumCounts[album] ?? 0) + 1
      }
    }
    const topAlbums = Object.entries(albumCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    return {
      placesWithPhotos: countPlacesWithPhotos(photoMap),
      totalPhotos: countAllMatchedPhotos(photoMap),
      topAlbums,
    }
  }, [photoMap])

  const maxListCount = Math.max(...Object.values(analytics.byList), 1)
  const maxCityCount = Math.max(...Object.values(analytics.byCity), 1)
  const maxCountryCount = Math.max(...Object.values(analytics.byCountry), 1)

  const sortedCities = Object.entries(analytics.byCity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)

  const sortedCountries = Object.entries(analytics.byCountry)
    .sort(([, a], [, b]) => b - a)

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Places" value={filteredPlaces.length} icon="📍" />
        <StatCard label="Lists" value={data.stats.totalLists} icon="📋" />
        <StatCard label="Countries" value={Object.keys(analytics.byCountry).length} icon="🌍" />
        <StatCard label="Avg Rating" value={data.stats.averageRating ? `⭐ ${data.stats.averageRating}` : 'N/A'} icon="" />
      </div>

      {/* Places by List */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Places by List</h3>
        <div className="space-y-2">
          {Object.entries(analytics.byList)
            .sort(([, a], [, b]) => b - a)
            .map(([list, count]) => (
              <div key={list} className="flex items-center gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getListColor(list) }}
                />
                <span className="text-xs w-32 truncate">{list}</span>
                <div className="flex-1 h-5 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(count / maxListCount) * 100}%`,
                      backgroundColor: getListColor(list),
                      opacity: 0.8,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--muted-foreground)] w-8 text-right">
                  {count}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Cities */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Top Cities</h3>
          <div className="space-y-2">
            {sortedCities.map(([city, count]) => (
              <div key={city} className="flex items-center gap-3">
                <span className="text-xs w-28 truncate">{city}</span>
                <div className="flex-1 h-4 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                    style={{ width: `${(count / maxCityCount) * 100}%`, opacity: 0.7 }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--muted-foreground)] w-6 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Countries</h3>
          <div className="space-y-2">
            {sortedCountries.map(([country, count]) => (
              <div key={country} className="flex items-center gap-3">
                <span className="text-xs w-28 truncate">{country}</span>
                <div className="flex-1 h-4 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                    style={{ width: `${(count / maxCountryCount) * 100}%`, opacity: 0.7 }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--muted-foreground)] w-6 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Frequency Chart */}
      {saveFrequency.totalWithDates > 0 && (
        <SaveFrequencySection analysis={saveFrequency} />
      )}

      {/* Ratings Distribution */}
      {data.stats.totalReviews > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Rating Distribution</h3>
          <div className="flex items-end gap-4 h-24 justify-center">
            {[1, 2, 3, 4, 5].map((rating) => {
              const count = analytics.ratingDist[rating] || 0
              const maxRating = Math.max(...Object.values(analytics.ratingDist), 1)
              const height = (count / maxRating) * 100
              return (
                <div key={rating} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-[var(--muted-foreground)]">{count}</span>
                  <div
                    className="w-10 rounded-t bg-[var(--accent)] transition-all duration-300 min-h-[2px]"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs">{'⭐'.repeat(rating)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Category Inference */}
      {categories.length > 0 && (
        <CategorySection categories={categories} />
      )}

      {/* Neighborhood Analysis */}
      {neighborhoods.length > 0 && (
        <NeighborhoodsSection neighborhoods={neighborhoods} />
      )}

      {/* Distance from Home/Work */}
      {distanceAnalyses.length > 0 && (
        <DistanceSection analyses={distanceAnalyses} />
      )}

      {/* Time-of-Day Pattern */}
      {timeOfDay.totalWithTime > 0 && (
        <TimeOfDaySection analysis={timeOfDay} />
      )}

      {/* Photo Stats */}
      {photoStats && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5" data-testid="photo-stats-section">
          <h3 className="text-sm font-semibold mb-2">📸 Photo Integration</h3>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Matched Google Photos takeout to your saved places by proximity
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">Places with Photos</p>
              <p className="text-lg font-bold" data-testid="photo-stat-places">{photoStats.placesWithPhotos}</p>
            </div>
            <div className="bg-[var(--muted)] rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">Total Matched Photos</p>
              <p className="text-lg font-bold" data-testid="photo-stat-total">{photoStats.totalPhotos}</p>
            </div>
          </div>
          {photoStats.topAlbums.length > 0 && (
            <div data-testid="photo-album-breakdown">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2 font-medium">Top Albums</p>
              <div className="space-y-1.5">
                {photoStats.topAlbums.map(([album, count]) => (
                  <div key={album} className="flex items-center gap-2" data-testid="photo-album-row">
                    <span className="text-xs text-[var(--foreground)] flex-1 truncate">{album}</span>
                    <div
                      className="h-1.5 rounded-full bg-[var(--primary)]/60 shrink-0"
                      style={{ width: `${Math.max(8, (count / photoStats.totalPhotos) * 80)}px` }}
                    />
                    <span className="text-xs font-medium tabular-nums text-[var(--muted-foreground)] w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rating Insights */}
      {ratingInsights.totalRated > 0 && (
        <RatingInsightsSection insights={ratingInsights} />
      )}

      {/* Duplicate Detection */}
      {duplicates.length > 0 && (
        <DuplicateDetectionSection duplicates={duplicates} />
      )}

      {/* You Might Like Suggestions */}
      {suggestionsResult.suggestions.length > 0 && (
        <SuggestionsSection
          suggestions={suggestionsResult.suggestions}
          tasteProfile={suggestionsResult.tasteProfile}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category Inference Section
// ---------------------------------------------------------------------------

function CategorySection({ categories }: { categories: CategoryCount[] }) {
  // Show top 12, exclude 'other' only if there are more specific ones
  const showOther = categories.every(c => c.category === 'other')
  const filtered = showOther ? categories : categories.filter(c => c.category !== 'other')
  const top = filtered.slice(0, 12)
  const maxCount = top[0]?.count ?? 1

  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5"
      data-testid="categories-section"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">Place Types</h3>
        <span className="text-xs text-[var(--muted-foreground)]">
          {categories.length} type{categories.length !== 1 ? 's' : ''} detected
        </span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">
        Inferred from place name patterns
      </p>

      {/* Emoji grid for top categories */}
      <div className="flex flex-wrap gap-2 mb-4" data-testid="category-chips">
        {top.map(({ category, info, count, percentage }) => (
          <div
            key={category}
            className="flex items-center gap-1.5 text-xs bg-[var(--muted)] rounded-full px-2.5 py-1 border border-[var(--border)]"
            title={`${info.label}: ${count} places (${percentage}%)`}
            data-testid="category-chip"
          >
            <span>{info.emoji}</span>
            <span className="font-medium">{info.label}</span>
            <span className="font-mono text-[var(--muted-foreground)]">{count}</span>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="space-y-2" data-testid="category-bars">
        {top.map(({ category, info, count, percentage }) => (
          <div key={category} className="flex items-center gap-3" data-testid="category-bar-row">
            <span className="text-base w-6 shrink-0 text-center">{info.emoji}</span>
            <span className="text-xs w-24 truncate shrink-0">{info.label}</span>
            <div className="flex-1 h-4 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(count / maxCount) * 100}%`,
                  backgroundColor: info.color,
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="text-xs font-mono text-[var(--muted-foreground)] w-8 text-right shrink-0">
              {count}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)] w-8 text-right shrink-0">
              {percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Neighborhood Analysis Section
// ---------------------------------------------------------------------------

const NBHD_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6',
  '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444',
]

function nbhdColor(index: number): string {
  return NBHD_COLORS[index % NBHD_COLORS.length]
}

function NeighborhoodsSection({ neighborhoods }: { neighborhoods: Neighborhood[] }) {
  const TOP_N = 15
  const [expanded, setExpanded] = useState<string | null>(null)

  const top = neighborhoods.slice(0, TOP_N)
  const maxCount = top[0]?.count ?? 1

  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5"
      data-testid="neighborhoods-section"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">Neighborhood Analysis</h3>
        <span className="text-xs text-[var(--muted-foreground)]">
          {neighborhoods.length} area{neighborhoods.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">
        Places grouped by postal code or proximity cluster
      </p>

      <div className="space-y-1" data-testid="neighborhoods-list">
        {top.map((nbhd, idx) => {
          const isOpen = expanded === nbhd.id
          return (
            <div key={nbhd.id} data-testid="neighborhood-row">
              {/* Row */}
              <button
                className="w-full flex items-center gap-3 py-1.5 hover:bg-[var(--muted)] rounded-lg px-1 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : nbhd.id)}
                aria-expanded={isOpen}
                aria-label={`${nbhd.name}: ${nbhd.count} places`}
              >
                {/* Rank badge */}
                <span
                  className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 text-white"
                  style={{ backgroundColor: nbhdColor(idx) }}
                >
                  {idx + 1}
                </span>

                {/* Name */}
                <span className="text-xs flex-1 truncate" title={nbhd.name}>{nbhd.name}</span>

                {/* City (only if different from name) */}
                {nbhd.city && !nbhd.name.startsWith(nbhd.city) && (
                  <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 hidden sm:inline">
                    {nbhd.city}
                  </span>
                )}

                {/* Bar */}
                <div className="w-24 h-3 bg-[var(--muted)] rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(nbhd.count / maxCount) * 100}%`,
                      backgroundColor: nbhdColor(idx),
                      opacity: 0.8,
                    }}
                  />
                </div>

                {/* Count */}
                <span className="text-xs font-mono text-[var(--muted-foreground)] w-5 text-right shrink-0">
                  {nbhd.count}
                </span>

                {/* Expand chevron */}
                <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 ml-1">
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div
                  className="ml-8 mt-1 mb-2 bg-[var(--muted)] rounded-lg p-3 space-y-2"
                  data-testid="neighborhood-detail"
                >
                  {/* Breakdown by list */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
                      By List
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(nbhd.byList)
                        .sort(([, a], [, b]) => b - a)
                        .map(([list, cnt]) => (
                          <span
                            key={list}
                            className="inline-flex items-center gap-1 text-[10px] bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-0.5"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: getListColor(list) }}
                            />
                            {list}
                            <span className="font-mono text-[var(--muted-foreground)]">
                              {cnt}
                            </span>
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Place list */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
                      Places
                    </p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {nbhd.places.slice(0, 20).map(p => (
                        <li key={p.id} className="flex items-center gap-1.5 text-xs">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: getListColor(p.list) }}
                          />
                          <span className="truncate">{p.name}</span>
                        </li>
                      ))}
                      {nbhd.places.length > 20 && (
                        <li className="text-[10px] text-[var(--muted-foreground)] pl-3">
                          +{nbhd.places.length - 20} more
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {neighborhoods.length > TOP_N && (
          <p className="text-xs text-[var(--muted-foreground)] pt-1 pl-1">
            +{neighborhoods.length - TOP_N} more areas not shown
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Save Frequency Section
// ---------------------------------------------------------------------------

const FREQ_BAR_COLOR = '#8b5cf6'
const DOW_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#818cf8', '#60a5fa', '#38bdf8']

function SaveFrequencySection({ analysis }: { analysis: SaveFrequencyAnalysis }) {
  const { months, dayOfWeek, years, peakMonth, peakDay, avgPerMonth } = analysis
  const [activeTab, setActiveTab] = useState<'monthly' | 'dow' | 'yearly'>('monthly')

  const maxMonthCount = Math.max(...months.map(m => m.count), 1)
  const maxRolling = Math.max(...months.map(m => m.rollingAvg), 1)
  const maxDow = Math.max(...dayOfWeek.map(d => d.count), 1)
  const maxYear = Math.max(...years.map(y => y.count), 1)

  // For year heatmap: months Jan-Dec
  const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4"
      data-testid="save-frequency-section"
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Save Frequency</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            When do you save places?
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {peakMonth && (
            <span className="bg-[var(--muted)] border border-[var(--border)] rounded-full px-2.5 py-1" data-testid="freq-peak-month">
              📅 Peak: <strong>{peakMonth.label}</strong> ({peakMonth.count})
            </span>
          )}
          {peakDay && (
            <span className="bg-[var(--muted)] border border-[var(--border)] rounded-full px-2.5 py-1" data-testid="freq-peak-day">
              📆 Best day: <strong>{peakDay.day}</strong>
            </span>
          )}
          <span className="bg-[var(--muted)] border border-[var(--border)] rounded-full px-2.5 py-1" data-testid="freq-avg">
            avg <strong>{avgPerMonth}/mo</strong>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]" data-testid="freq-tabs">
        {(['monthly', 'dow', 'yearly'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
            data-testid={`freq-tab-${tab}`}
          >
            {tab === 'monthly' ? 'Monthly' : tab === 'dow' ? 'By Day' : 'By Year'}
          </button>
        ))}
      </div>

      {/* Monthly chart */}
      {activeTab === 'monthly' && (
        <div data-testid="freq-monthly-chart">
          {months.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No dated saves</p>
          ) : (
            <>
              {/* Bar chart with SVG rolling avg line overlay */}
              <div className="relative">
                {/* Bars */}
                <div className="flex items-end gap-px h-36" data-testid="freq-month-bars">
                  {months.map((m) => {
                    const barH = maxMonthCount > 0 ? (m.count / maxMonthCount) * 100 : 0
                    return (
                      <div
                        key={m.month}
                        className="flex-1 flex flex-col items-center gap-0.5 group relative"
                        data-testid="freq-month-bar"
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                          <div className="bg-[var(--foreground)] text-[var(--background)] text-[9px] font-medium px-1.5 py-0.5 rounded">
                            {m.label}: {m.count}
                          </div>
                        </div>
                        <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                          <div
                            className="w-full rounded-t transition-all duration-300 min-h-[2px]"
                            style={{
                              height: `${barH}%`,
                              backgroundColor: FREQ_BAR_COLOR,
                              opacity: m.count > 0 ? 0.75 : 0.2,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Rolling average line (SVG overlay) */}
                {months.length > 2 && (
                  <svg
                    className="absolute inset-0 w-full pointer-events-none"
                    style={{ height: '9rem' }}
                    preserveAspectRatio="none"
                    viewBox={`0 0 ${months.length} 100`}
                    data-testid="freq-rolling-avg-line"
                  >
                    <polyline
                      points={months
                        .map((m, i) => {
                          const x = i + 0.5
                          const y = 100 - (m.rollingAvg / maxRolling) * 90 - 5
                          return `${x},${y}`
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="0.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.85"
                    />
                  </svg>
                )}
              </div>

              {/* X axis labels — show subset */}
              <div className="flex items-center gap-px mt-1" data-testid="freq-month-labels">
                {months.map((m, i) => {
                  // Show label every ~6 months or fewer
                  const step = months.length <= 12 ? 1 : months.length <= 24 ? 2 : 6
                  const show = i % step === 0
                  return (
                    <div key={m.month} className="flex-1 text-center">
                      {show && (
                        <span className="text-[8px] text-[var(--muted-foreground)] block truncate">
                          {m.label.substring(0, 3)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] text-[var(--muted-foreground)] mt-2">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: FREQ_BAR_COLOR, opacity: 0.75 }} />
                  Monthly saves
                </span>
                {months.length > 2 && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 inline-block bg-amber-400" />
                    3-month avg
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Day of week chart */}
      {activeTab === 'dow' && (
        <div data-testid="freq-dow-chart">
          <div className="space-y-2">
            {dayOfWeek.map((d, i) => (
              <div key={d.day} className="flex items-center gap-3" data-testid="freq-dow-row">
                <span className="text-xs w-8 shrink-0 font-medium">{d.day}</span>
                <div className="flex-1 h-5 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: maxDow > 0 ? `${(d.count / maxDow) * 100}%` : '0%',
                      backgroundColor: DOW_COLORS[i % DOW_COLORS.length],
                      opacity: 0.8,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--muted-foreground)] w-6 text-right shrink-0">
                  {d.count}
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)] w-8 text-right shrink-0">
                  {d.percentage}%
                </span>
              </div>
            ))}
          </div>
          {peakDay && (
            <p className="text-xs text-[var(--muted-foreground)] mt-3">
              📊 Most saves happen on <strong>{peakDay.day}</strong> ({peakDay.percentage}% of dated saves)
            </p>
          )}
        </div>
      )}

      {/* Year breakdown */}
      {activeTab === 'yearly' && (
        <div data-testid="freq-yearly-chart">
          {years.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No yearly data</p>
          ) : (
            <div className="space-y-4">
              {years.map(year => (
                <div key={year.year} data-testid="freq-year-row">
                  {/* Year header with bar */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold w-10 shrink-0">{year.year}</span>
                    <div className="flex-1 h-4 bg-[var(--muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(year.count / maxYear) * 100}%`,
                          backgroundColor: FREQ_BAR_COLOR,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-[var(--muted-foreground)] w-8 text-right shrink-0">
                      {year.count}
                    </span>
                  </div>
                  {/* Mini month heatmap */}
                  <div className="flex gap-1 ml-14" data-testid={`freq-year-heatmap-${year.year}`}>
                    {Array.from({ length: 12 }, (_, mi) => {
                      const mm = String(mi + 1).padStart(2, '0')
                      const cnt = year.months[mm] ?? 0
                      const maxInYear = Math.max(...Object.values(year.months), 1)
                      const opacity = cnt > 0 ? 0.25 + (cnt / maxInYear) * 0.75 : 0.08
                      return (
                        <div
                          key={mm}
                          className="flex-1 flex flex-col items-center gap-0.5"
                          title={`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mi]} ${year.year}: ${cnt}`}
                        >
                          <div
                            className="w-full rounded-sm"
                            style={{
                              height: '14px',
                              backgroundColor: FREQ_BAR_COLOR,
                              opacity,
                            }}
                          />
                          <span className="text-[8px] text-[var(--muted-foreground)]">
                            {MONTH_LABELS[mi]}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Distance from Home / Work Section
// ---------------------------------------------------------------------------

const BUCKET_COLORS = [
  '#8b5cf6', // < 1 km
  '#6366f1', // 1–5 km
  '#3b82f6', // 5–25 km
  '#0ea5e9', // 25–100 km
  '#f97316', // 100–500 km
  '#ef4444', // > 500 km
]

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 100) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

function DistanceSection({ analyses }: { analyses: DistanceAnalysis[] }) {
  const [activeRef, setActiveRef] = useState(0)
  const [showTop, setShowTop] = useState(false)

  const analysis = analyses[activeRef]
  if (!analysis) return null

  const { buckets, results, reference } = analysis
  const maxBucketCount = Math.max(...buckets.map(b => b.count), 1)

  const TOP_N = 5

  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-5"
      data-testid="distance-section"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Distance from Reference Points</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            How far are your saved places from Home, Work, and other labeled locations?
          </p>
        </div>
      </div>

      {/* Reference selector (tabs) */}
      {analyses.length > 1 && (
        <div
          className="flex flex-wrap gap-2"
          data-testid="distance-ref-tabs"
        >
          {analyses.map((a, i) => (
            <button
              key={a.reference.name + i}
              onClick={() => setActiveRef(i)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeRef === i
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)]'
              }`}
              data-testid={`distance-tab-${i}`}
            >
              {a.reference.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        data-testid="distance-stats"
      >
        {[
          { label: 'Nearest', value: formatKm(analysis.minDistanceKm) },
          { label: 'Farthest', value: formatKm(analysis.maxDistanceKm) },
          { label: 'Average', value: formatKm(analysis.avgDistanceKm) },
          { label: 'Median', value: formatKm(analysis.medianDistanceKm) },
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-[var(--muted)] rounded-lg px-3 py-2 text-center"
          >
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">
              {stat.label}
            </p>
            <p className="text-sm font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Bucket bar chart */}
      <div data-testid="distance-buckets">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
          Distribution
        </p>
        <div className="space-y-2">
          {buckets.map((bucket, idx) => (
            <div key={bucket.label} className="flex items-center gap-3" data-testid="distance-bucket-row">
              <span className="text-[10px] w-28 shrink-0 text-[var(--muted-foreground)]">
                {bucket.label}
              </span>
              <div className="flex-1 h-4 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: bucket.count === 0 ? '0%' : `${(bucket.count / maxBucketCount) * 100}%`,
                    backgroundColor: BUCKET_COLORS[idx] ?? '#8b5cf6',
                    opacity: 0.85,
                  }}
                />
              </div>
              <span className="text-xs font-mono text-[var(--muted-foreground)] w-6 text-right shrink-0">
                {bucket.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Closest places */}
      <div data-testid="distance-closest">
        <button
          className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2 hover:text-[var(--foreground)] transition-colors"
          onClick={() => setShowTop(v => !v)}
          data-testid="distance-top-toggle"
        >
          <span>Closest places to {reference.name}</span>
          <span>{showTop ? '▲' : '▼'}</span>
        </button>
        {showTop && (
          <ul className="space-y-1.5" data-testid="distance-top-list">
            {results.slice(0, TOP_N).map((r, i) => (
              <li
                key={r.place.id}
                className="flex items-center gap-2 text-xs"
                data-testid="distance-place-row"
              >
                <span className="w-4 h-4 rounded-full bg-[var(--muted)] text-[9px] flex items-center justify-center font-bold shrink-0 text-[var(--muted-foreground)]">
                  {i + 1}
                </span>
                <span className="flex-1 truncate">{r.place.name}</span>
                <span className="font-mono text-[var(--muted-foreground)] shrink-0">
                  {formatKm(r.distanceKm)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// You Might Like Suggestions Section
// ---------------------------------------------------------------------------

function SuggestionsSection({
  suggestions,
  tasteProfile,
}: {
  suggestions: Suggestion[]
  tasteProfile: string
}) {
  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5"
      data-testid="suggestions-section"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">✨ You Might Like</h3>
        <span className="text-xs text-[var(--muted-foreground)]">
          {suggestions.length} idea{suggestions.length !== 1 ? 's' : ''}
        </span>
      </div>
      {tasteProfile && (
        <p className="text-xs text-[var(--muted-foreground)] mb-4 leading-relaxed" data-testid="suggestions-taste-profile">
          {tasteProfile}
        </p>
      )}

      {/* Suggestion cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="suggestions-grid">
        {suggestions.map(suggestion => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </div>
    </div>
  )
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  return (
    <div
      className="border border-[var(--border)] rounded-lg p-3.5 bg-[var(--muted)] hover:border-[var(--primary)] transition-colors group"
      data-testid="suggestion-card"
    >
      {/* Emoji + title row */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xl shrink-0 mt-0.5" data-testid="suggestion-emoji">
          {suggestion.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" data-testid="suggestion-title">
            {suggestion.title}
          </p>
          {suggestion.tag && (
            <span
              className="inline-block text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: suggestion.tagColor ?? '#8b5cf6' }}
              data-testid="suggestion-tag"
            >
              {suggestion.tag}
            </span>
          )}
        </div>
      </div>

      {/* Body text */}
      <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed" data-testid="suggestion-body">
        {suggestion.body}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Time-of-Day Pattern Section
// ---------------------------------------------------------------------------

const TOD_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6']

function TimeOfDaySection({ analysis }: { analysis: TimeOfDayAnalysis }) {
  const { buckets, totalWithTime, peakPeriod, hourDistribution } = analysis
  const maxBucket = Math.max(...buckets.map(b => b.count), 1)
  const maxHour = Math.max(...hourDistribution.map(h => h.count), 1)

  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4"
      data-testid="time-of-day-section"
    >
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Time-of-Day Pattern</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            When do you save places? ({totalWithTime} saves with timestamps)
          </p>
        </div>
        {peakPeriod && (
          <span className="bg-[var(--muted)] border border-[var(--border)] rounded-full px-2.5 py-1 text-xs" data-testid="tod-peak">
            {peakPeriod.emoji} Peak: <strong>{peakPeriod.label}</strong> ({peakPeriod.percentage}%)
          </span>
        )}
      </div>

      {/* Period buckets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="tod-buckets">
        {buckets.map((bucket, i) => (
          <div
            key={bucket.label}
            className="bg-[var(--muted)] rounded-lg p-3 text-center"
            data-testid="tod-bucket"
          >
            <span className="text-xl">{bucket.emoji}</span>
            <p className="text-xs font-semibold mt-1">{bucket.label}</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">{bucket.hourRange}</p>
            <p className="text-lg font-bold mt-1" style={{ color: TOD_COLORS[i] }}>{bucket.count}</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">{bucket.percentage}%</p>
          </div>
        ))}
      </div>

      {/* Hourly distribution */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
          Hourly Distribution (24h)
        </p>
        <div className="flex items-end gap-px h-20" data-testid="tod-hour-chart">
          {hourDistribution.map(({ hour, count }) => {
            const h = maxHour > 0 ? (count / maxHour) * 100 : 0
            const periodIdx = hour >= 6 && hour < 12 ? 0 : hour >= 12 && hour < 17 ? 1 : hour >= 17 && hour < 21 ? 2 : 3
            return (
              <div
                key={hour}
                className="flex-1 flex flex-col items-center gap-0.5 group relative"
                title={`${hour}:00 — ${count} save${count !== 1 ? 's' : ''}`}
              >
                <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                  <div
                    className="w-full rounded-t transition-all duration-300 min-h-[1px]"
                    style={{
                      height: `${h}%`,
                      backgroundColor: TOD_COLORS[periodIdx],
                      opacity: count > 0 ? 0.8 : 0.15,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-px mt-0.5">
          {[0, 6, 12, 18, 23].map(h => (
            <div key={h} className="text-[8px] text-[var(--muted-foreground)]" style={{ marginLeft: h === 0 ? 0 : `${((h - (h === 6 ? 0 : h === 12 ? 6 : h === 18 ? 12 : 18)) / 24) * 100}%` }}>
              {h}:00
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


