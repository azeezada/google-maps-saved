'use client'

import { useMemo, useState, useCallback } from 'react'
import type { ParsedData, Place } from '@/lib/types'
import { detectTrips, type Trip } from '@/lib/trips'
import { getCategoryInfo } from '@/lib/categories'
import type { PlaceCategory } from '@/lib/categories'

interface DiaryViewProps {
  data: ParsedData
  filteredPlaces: Place[]
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function fmtShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return iso }
}

function generateNarrative(trip: Trip): string {
  const places = trip.places.slice().sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1)
  const cityCount = new Map<string, number>()
  const categories = new Map<string, number>()

  for (const p of places) {
    if (p.city && p.city !== 'Unknown') cityCount.set(p.city, (cityCount.get(p.city) || 0) + 1)
    if (p.category && p.category !== 'other') categories.set(p.category, (categories.get(p.category) || 0) + 1)
  }

  const topCities = [...cityCount.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
  const topCategories = [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0])

  const lines: string[] = []

  // Opening
  if (trip.durationDays === 1) {
    lines.push(`A day trip to ${trip.name.replace('Trip to ', '')}. `)
  } else {
    lines.push(`${trip.name} lasted ${trip.durationDays} days, from ${fmtShort(trip.startDate)} to ${fmtShort(trip.endDate)}. `)
  }

  if (topCities.length > 1) {
    lines.push(`The journey spanned ${topCities.length} cities: ${topCities.slice(0, 4).join(', ')}${topCities.length > 4 ? ` and ${topCities.length - 4} more` : ''}. `)
  }

  // Categories
  if (topCategories.length > 0) {
    const catLabels = topCategories.map(c => getCategoryInfo(c as PlaceCategory).label.toLowerCase())
    lines.push(`Highlights included ${catLabels.join(', ')} spots. `)
  }

  // Day-by-day
  const byDay = new Map<string, Place[]>()
  for (const p of places) {
    const day = p.date?.substring(0, 10) ?? 'undated'
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(p)
  }

  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [day, dayPlaces] of days) {
    if (day === 'undated') continue
    const names = dayPlaces.map(p => p.name).slice(0, 4)
    const dayLabel = fmtDate(day)
    if (names.length === 1) {
      lines.push(`\n\nOn ${dayLabel}, visited ${names[0]}.`)
    } else {
      lines.push(`\n\nOn ${dayLabel}, explored ${names.join(', ')}${dayPlaces.length > 4 ? ` and ${dayPlaces.length - 4} more places` : ''}.`)
    }
    // Add reviews/notes
    for (const p of dayPlaces) {
      if (p.reviewText) lines.push(` "${p.reviewText}"`)
      if (p.rating) lines.push(` (${p.rating}/5 stars)`)
    }
  }

  return lines.join('')
}

export function DiaryView({ data, filteredPlaces }: DiaryViewProps) {
  const trips = useMemo(() => detectTrips(filteredPlaces), [filteredPlaces])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

  const selectedTrip = trips.find(t => t.id === selectedTripId) ?? null
  const narrative = useMemo(
    () => selectedTrip ? generateNarrative(selectedTrip) : null,
    [selectedTrip],
  )

  const handleCopy = useCallback(() => {
    if (narrative) navigator.clipboard?.writeText(narrative)
  }, [narrative])

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="diary-view">
      {/* Trip selector */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-4 flex-wrap">
        <span className="text-xl">📔</span>
        <h2 className="text-sm font-semibold">Travel Diary</h2>
        <select
          value={selectedTripId ?? ''}
          onChange={e => setSelectedTripId(e.target.value || null)}
          className="text-xs bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-1.5 min-w-[200px]"
          data-testid="diary-trip-select"
          aria-label="Select a trip"
        >
          <option value="">Select a trip...</option>
          {trips.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} ({fmtShort(t.startDate)} – {fmtShort(t.endDate)})
            </option>
          ))}
        </select>
        {narrative && (
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--muted)] hover:bg-[var(--primary)] hover:text-white transition-colors"
            data-testid="diary-copy-btn"
          >
            Copy to clipboard
          </button>
        )}
      </div>

      {!selectedTrip ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <span className="text-5xl">📔</span>
          <h2 className="text-lg font-semibold">Travel Diary Generator</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
            {trips.length > 0
              ? `Select one of your ${trips.length} detected trips to generate a readable travel narrative.`
              : 'No trips detected. Upload data with dates to enable trip detection and diary generation.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto">
          {/* Trip header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2" data-testid="diary-title">{selectedTrip.name}</h2>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
              <span>{fmtDate(selectedTrip.startDate)} – {fmtDate(selectedTrip.endDate)}</span>
              <span>{selectedTrip.durationDays} day{selectedTrip.durationDays !== 1 ? 's' : ''}</span>
              <span>{selectedTrip.places.length} places</span>
              {selectedTrip.dominantCountry && <span>{selectedTrip.dominantCountry}</span>}
            </div>
          </div>

          {/* Narrative */}
          <div
            className="prose prose-invert prose-sm max-w-none bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 whitespace-pre-wrap leading-relaxed text-sm"
            data-testid="diary-narrative"
          >
            {narrative}
          </div>

          {/* Day-by-day timeline */}
          <div className="mt-8 space-y-4" data-testid="diary-timeline">
            <h3 className="text-sm font-semibold">Timeline</h3>
            {(() => {
              const sorted = selectedTrip.places.slice().sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1)
              const byDay = new Map<string, Place[]>()
              for (const p of sorted) {
                const d = p.date?.substring(0, 10) ?? 'undated'
                if (!byDay.has(d)) byDay.set(d, [])
                byDay.get(d)!.push(p)
              }
              return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, places]) => (
                <div key={day} className="border-l-2 border-[var(--primary)] pl-4">
                  <p className="text-xs font-semibold text-[var(--primary)] mb-1">
                    {day === 'undated' ? 'Undated' : fmtDate(day)}
                  </p>
                  {places.map(p => (
                    <div key={p.id} className="flex items-start gap-2 py-1">
                      <span className="text-sm shrink-0">
                        {p.category ? getCategoryInfo(p.category as PlaceCategory).emoji : '📍'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{p.name}</p>
                        {p.city && <p className="text-[10px] text-[var(--muted-foreground)]">{p.city}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
