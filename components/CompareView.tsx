'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { ParsedData, Place } from '@/lib/types'
import { getListColor } from './Sidebar'

const CompareMap = dynamic(() => import('./CompareMap'), { ssr: false })

interface CompareViewProps {
  data: ParsedData
}

export function CompareView({ data }: CompareViewProps) {
  const [listA, setListA] = useState<string>('')
  const [listB, setListB] = useState<string>('')

  const lists = data.lists

  const placesA = useMemo(
    () => (listA ? data.places.filter(p => p.list === listA) : []),
    [data.places, listA],
  )
  const placesB = useMemo(
    () => (listB ? data.places.filter(p => p.list === listB) : []),
    [data.places, listB],
  )

  const statsA = useMemo(() => computeStats(placesA), [placesA])
  const statsB = useMemo(() => computeStats(placesB), [placesB])

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="compare-view">
      {/* List selectors */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: listA ? getListColor(listA) : '#6b7280' }} />
          <select
            value={listA}
            onChange={e => setListA(e.target.value)}
            className="text-xs bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-1.5 min-w-[140px]"
            data-testid="compare-select-a"
            aria-label="Select first list"
          >
            <option value="">Select list A</option>
            {lists.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          {listA && <span className="text-xs text-[var(--muted-foreground)]">{placesA.length} places</span>}
        </div>

        <span className="text-xs text-[var(--muted-foreground)] font-bold">VS</span>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: listB ? getListColor(listB) : '#6b7280' }} />
          <select
            value={listB}
            onChange={e => setListB(e.target.value)}
            className="text-xs bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-1.5 min-w-[140px]"
            data-testid="compare-select-b"
            aria-label="Select second list"
          >
            <option value="">Select list B</option>
            {lists.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          {listB && <span className="text-xs text-[var(--muted-foreground)]">{placesB.length} places</span>}
        </div>
      </div>

      {!listA && !listB ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <span className="text-5xl">🔀</span>
          <h2 className="text-lg font-semibold">Compare Lists</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
            Select two lists above to compare them side-by-side on the map.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Stats comparison */}
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Comparison</h3>
            <CompareStatRow label="Places" a={statsA.count} b={statsB.count} />
            <CompareStatRow label="Countries" a={statsA.countries} b={statsB.countries} />
            <CompareStatRow label="Cities" a={statsA.cities} b={statsB.cities} />
            <CompareStatRow label="With Coords" a={statsA.withCoords} b={statsB.withCoords} />
            <CompareStatRow label="With Date" a={statsA.withDate} b={statsB.withDate} />
            {(statsA.avgRating > 0 || statsB.avgRating > 0) && (
              <CompareStatRow label="Avg Rating" a={statsA.avgRating.toFixed(1)} b={statsB.avgRating.toFixed(1)} />
            )}

            {/* Overlap section */}
            {listA && listB && (
              <div className="pt-3 border-t border-[var(--border)]">
                <h4 className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Shared Cities</h4>
                {statsA.citySet && statsB.citySet && (() => {
                  const shared = [...statsA.citySet].filter(c => statsB.citySet.has(c))
                  return shared.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {shared.slice(0, 10).map(c => (
                        <span key={c} className="text-[10px] bg-[var(--muted)] rounded-full px-2 py-0.5">{c}</span>
                      ))}
                      {shared.length > 10 && <span className="text-[10px] text-[var(--muted-foreground)]">+{shared.length - 10}</span>}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[var(--muted-foreground)]">No shared cities</p>
                  )
                })()}
              </div>
            )}
          </aside>

          {/* Map */}
          <div className="flex-1 relative z-0">
            <CompareMap
              placesA={placesA}
              placesB={placesB}
              colorA={listA ? getListColor(listA) : '#3b82f6'}
              colorB={listB ? getListColor(listB) : '#ef4444'}
              labelA={listA || 'List A'}
              labelB={listB || 'List B'}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function CompareStatRow({ label, a, b }: { label: string; a: string | number; b: string | number }) {
  return (
    <div className="flex items-center gap-2 text-xs" data-testid="compare-stat-row">
      <span className="w-16 text-[var(--muted-foreground)] shrink-0">{label}</span>
      <span className="flex-1 text-right font-mono font-bold">{a}</span>
      <span className="text-[var(--muted-foreground)]">vs</span>
      <span className="flex-1 font-mono font-bold">{b}</span>
    </div>
  )
}

function computeStats(places: Place[]) {
  const citySet = new Set(places.map(p => p.city).filter(c => c && c !== 'Unknown'))
  const countrySet = new Set(places.map(p => p.country).filter(Boolean))
  const withCoords = places.filter(p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0).length
  const withDate = places.filter(p => p.date).length
  const ratings = places.filter(p => p.rating).map(p => p.rating!)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

  return {
    count: places.length,
    countries: countrySet.size,
    cities: citySet.size,
    withCoords,
    withDate,
    avgRating,
    citySet,
  }
}
