'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ParsedData, Place } from '@/lib/types'
import { detectTrips, type Trip } from '@/lib/trips'
import { PlaceDetailModal } from './PlaceDetailModal'

// Leaflet must be loaded client-side only
const TripMap = dynamic(() => import('./TripMap'), { ssr: false })

interface TripsViewProps {
  data: ParsedData
  filteredPlaces: Place[]
}

export function TripsView({ data, filteredPlaces }: TripsViewProps) {
  const trips = useMemo(() => detectTrips(filteredPlaces), [filteredPlaces])
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [detailPlace, setDetailPlace] = useState<Place | null>(null)

  const placesWithTrips = useMemo(
    () => trips.reduce((s, t) => s + t.places.length, 0),
    [trips],
  )
  const placesWithDate = useMemo(
    () => filteredPlaces.filter(p => p.date).length,
    [filteredPlaces],
  )

  // Format a date string nicely
  function fmtDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-4 flex-wrap">
        <Pill icon="✈️" label={`${trips.length} trip${trips.length !== 1 ? 's' : ''} detected`} />
        <Pill icon="📍" label={`${placesWithTrips} places grouped`} />
        {placesWithDate > 0 && (
          <Pill icon="📅" label={`${placesWithDate} dated places`} />
        )}
        {placesWithDate === 0 && (
          <span className="text-xs text-amber-500">
            ⚠️ No dates found — upload data with save dates to enable trip detection
          </span>
        )}
      </div>

      {trips.length === 0 ? (
        <EmptyState hasData={filteredPlaces.length > 0} hasDate={placesWithDate > 0} />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Trip list panel */}
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--background)]">
            <div className="p-3 space-y-2">
              {trips.map(trip => (
                <button
                  key={trip.id}
                  data-testid="trip-card"
                  onClick={() => setSelectedTrip(t => (t?.id === trip.id ? null : trip))}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    selectedTrip?.id === trip.id
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 shadow-sm'
                      : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--muted)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug">{trip.name}</span>
                    <span className="text-[10px] bg-[var(--muted)] text-[var(--muted-foreground)] rounded-full px-2 py-0.5 shrink-0 font-mono">
                      {trip.places.length}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {fmtDate(trip.startDate)}
                    {trip.startDate !== trip.endDate && ` – ${fmtDate(trip.endDate)}`}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                    {trip.durationDays} day{trip.durationDays !== 1 ? 's' : ''}
                    {trip.dominantCountry && ` · ${trip.dominantCountry}`}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Map + place list */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedTrip ? (
              <>
                {/* Mini map */}
                <div className="h-64 shrink-0 relative z-0">
                  <TripMap trip={selectedTrip} onSelectPlace={setDetailPlace} />
                </div>

                {/* Place list for selected trip */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 px-1">
                    {selectedTrip.places.length} places in {selectedTrip.name}
                  </h3>
                  {selectedTrip.places
                    .slice()
                    .sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1)
                    .map(place => (
                      <button
                        key={place.id}
                        data-testid="trip-place-row"
                        onClick={() => setDetailPlace(place)}
                        className="w-full text-left rounded-lg px-3 py-2 hover:bg-[var(--muted)] transition-colors flex items-start gap-3"
                      >
                        <span className="text-base shrink-0 mt-0.5">📍</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{place.name}</p>
                          {place.date && (
                            <p className="text-[11px] text-[var(--muted-foreground)]">
                              {fmtDate(place.date)}
                            </p>
                          )}
                          {place.address && (
                            <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                              {place.address}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              </>
            ) : (
              /* Global overview map showing all trip centroids */
              <div className="flex-1 relative z-0">
                <TripMap trips={trips} onSelectTrip={setSelectedTrip} />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-[var(--muted-foreground)] bg-[var(--card)]/90 rounded-full px-3 py-1.5 pointer-events-none shadow">
                  Click a trip card to explore
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <PlaceDetailModal place={detailPlace} onClose={() => setDetailPlace(null)} />
    </div>
  )
}

function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs bg-[var(--muted)] rounded-full px-3 py-1">
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  )
}

function EmptyState({ hasData, hasDate }: { hasData: boolean; hasDate: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
      <span className="text-5xl">✈️</span>
      <h2 className="text-lg font-semibold">No trips detected</h2>
      {!hasData ? (
        <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
          Upload your Google Takeout data to see your trips.
        </p>
      ) : !hasDate ? (
        <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
          Your places don't have save dates. Trip detection requires dated places from Google
          Takeout (Saved Places.json or Reviews.json).
        </p>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
          Not enough places cluster into trips with the current filters. Try clearing filters
          or uploading more data.
        </p>
      )}
    </div>
  )
}
