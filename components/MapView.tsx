'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { Place, LabeledPlace, ParsedData, FilterState } from '@/lib/types'
import { getListColor } from './Sidebar'
import { SearchBar } from './SearchBar'

// Map style configurations
export type MapStyleId = 'dark' | 'light' | 'satellite' | 'streets'

interface MapStyleConfig {
  id: MapStyleId
  label: string
  icon: string
  url: string
  attribution: string
  maxZoom: number
}

export const MAP_STYLES: MapStyleConfig[] = [
  {
    id: 'dark',
    label: 'Dark',
    icon: '🌑',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
  {
    id: 'light',
    label: 'Light',
    icon: '☀️',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
  {
    id: 'streets',
    label: 'Streets',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
  },
]

interface MapViewProps {
  places: Place[]
  labeledPlaces: LabeledPlace[]
  data?: ParsedData
  filters?: FilterState
  onFiltersChange?: (filters: FilterState) => void
  /** Increment to imperatively focus the floating search bar */
  searchFocusTrigger?: number
  /** Called when a map marker is clicked to open the detail modal */
  onSelectPlace?: (place: Place) => void
  /** When set, the map smoothly flies to this place */
  flyToPlace?: Place | null
  /** Called when fly-to animation completes so parent can reset flyToPlace */
  onFlyComplete?: () => void
}

export function MapView({ places, labeledPlaces, data, filters, onFiltersChange, searchFocusTrigger, onSelectPlace, flyToPlace, onFlyComplete }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const clusterGroupRef = useRef<any>(null)
  const heatLayerRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const labelMarkersRef = useRef<any[]>([])
  const pulseMarkerRef = useRef<any>(null)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [clusteringEnabled, setClusteringEnabled] = useState(true)
  const [heatmapEnabled, setHeatmapEnabled] = useState(false)
  const [mapStyleId, setMapStyleId] = useState<MapStyleId>('dark')
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [flyToast, setFlyToast] = useState<string | null>(null)
  const [heatmapTimeFilter, setHeatmapTimeFilter] = useState<string | null>(null) // null = all time, "YYYY-MM" for specific month
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<number | null>(null)
  const animationIndexRef = useRef(0)

  // Compute available months from places with dates
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    for (const p of places) {
      if (p.date) months.add(p.date.substring(0, 7))
    }
    return Array.from(months).sort()
  }, [places])

  // Animation: cycle through months
  const toggleAnimation = useCallback(() => {
    if (isAnimating) {
      // Stop animation
      if (animationRef.current) clearInterval(animationRef.current)
      animationRef.current = null
      setIsAnimating(false)
      setHeatmapTimeFilter(null)
      return
    }

    if (availableMonths.length < 2) return
    setIsAnimating(true)
    animationIndexRef.current = 0
    setHeatmapTimeFilter(availableMonths[0])

    animationRef.current = window.setInterval(() => {
      animationIndexRef.current++
      if (animationIndexRef.current >= availableMonths.length) {
        animationIndexRef.current = 0
      }
      setHeatmapTimeFilter(availableMonths[animationIndexRef.current])
    }, 1200)
  }, [isAnimating, availableMonths])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) clearInterval(animationRef.current)
    }
  }, [])

  // Esc closes the place detail panel and style menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPlace(null)
        setStyleMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Click outside closes style menu
  useEffect(() => {
    if (!styleMenuOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-testid="map-style-toggle"]') && !target.closest('[data-testid="map-style-menu"]')) {
        setStyleMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [styleMenuOpen])

  // Fly to a specific place when flyToPlace changes
  useEffect(() => {
    if (!flyToPlace || !mapInstanceRef.current || !mapLoaded) return
    if (!flyToPlace.coordinates.lat && !flyToPlace.coordinates.lng) return

    const map = mapInstanceRef.current
    const { lat, lng } = flyToPlace.coordinates

    // Show fly-to toast
    setFlyToast(flyToPlace.name)

    // Add a pulse marker at the destination
    import('leaflet').then((Lmod) => {
      const L: any = Lmod.default ?? Lmod

      // Remove any previous pulse marker
      if (pulseMarkerRef.current) {
        pulseMarkerRef.current.remove()
        pulseMarkerRef.current = null
      }

      const pulseIcon = L.divIcon({
        html: `<div data-testid="fly-pulse-marker" style="
          width: 24px; height: 24px; border-radius: 50%;
          background: rgba(168,85,247,0.4);
          border: 3px solid #a855f7;
          box-shadow: 0 0 0 0 rgba(168,85,247,0.7);
          animation: flyPulse 1.5s ease-out 3;
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: 'fly-pulse-icon',
      })

      const pulseMarker = L.marker([lat, lng], { icon: pulseIcon, zIndexOffset: 1000 })
      pulseMarker.addTo(map)
      pulseMarkerRef.current = pulseMarker

      // Remove pulse marker after animation finishes
      setTimeout(() => {
        if (pulseMarkerRef.current) {
          pulseMarkerRef.current.remove()
          pulseMarkerRef.current = null
        }
      }, 5000)
    })

    // Fly the map
    map.flyTo([lat, lng], 16, { duration: 1.2, easeLinearity: 0.25 })

    // Listen for moveend to clear toast and notify parent
    const onMoveEnd = () => {
      setFlyToast(null)
      onFlyComplete?.()
      map.off('moveend', onMoveEnd)
    }
    map.on('moveend', onMoveEnd)

    // Fallback: clear toast after 3s if moveend hasn't fired
    const toastTimeout = setTimeout(() => {
      setFlyToast(null)
      onFlyComplete?.()
      map.off('moveend', onMoveEnd)
    }, 3000)

    return () => {
      clearTimeout(toastTimeout)
      map.off('moveend', onMoveEnd)
    }
  }, [flyToPlace, mapLoaded, onFlyComplete])

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then(async (Lmod) => {
      // Expose L globally so plugins (markercluster, heat) can find it
      const L: any = Lmod.default ?? Lmod
      ;(window as any).L = L
      await import('leaflet.markercluster')
      await import('leaflet.heat')

      if (!mapRef.current) return

      // Guard against React strict-mode double-invoke
      const container = mapRef.current as any
      if (container._leaflet_id) {
        container._leaflet_id = undefined
      }

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([40.7128, -74.006], 12)

      // Initial tile layer (dark by default)
      const initialStyle = MAP_STYLES.find(s => s.id === 'dark')!
      const tileLayer = L.tileLayer(initialStyle.url, {
        attribution: initialStyle.attribution,
        maxZoom: initialStyle.maxZoom,
      })
      tileLayer.addTo(map)
      tileLayerRef.current = tileLayer

      mapInstanceRef.current = map
      setMapLoaded(true)
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        clusterGroupRef.current = null
        tileLayerRef.current = null
      }
    }
  }, [])

  // Swap tile layer when map style changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return

    import('leaflet').then((Lmod) => {
      const L: any = Lmod.default ?? Lmod
      const map = mapInstanceRef.current
      if (!map) return

      const styleConfig = MAP_STYLES.find(s => s.id === mapStyleId)
      if (!styleConfig) return

      // Remove old tile layer
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current)
      }

      // Add new tile layer
      const newTileLayer = L.tileLayer(styleConfig.url, {
        attribution: styleConfig.attribution,
        maxZoom: styleConfig.maxZoom,
      })
      newTileLayer.addTo(map)
      // Move tile layer to the bottom so markers appear on top
      newTileLayer.bringToBack()
      tileLayerRef.current = newTileLayer
    })
  }, [mapStyleId, mapLoaded])

  // Update markers when places/clustering/heatmap change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return

    import('leaflet').then(async (Lmod) => {
      // Ensure L is globally available (plugins may be cached, but just in case)
      const L: any = Lmod.default ?? Lmod
      ;(window as any).L = L
      await import('leaflet.markercluster')
      await import('leaflet.heat')

      const map = mapInstanceRef.current
      if (!map) return

      // Remove old cluster group / heatmap / label markers
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current)
        clusterGroupRef.current = null
      }
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
      labelMarkersRef.current.forEach(m => m.remove())
      labelMarkersRef.current = []

      let validPlaces = places.filter(
        p => p.coordinates.lat !== 0 && p.coordinates.lng !== 0
      )

      // Apply time filter for heatmap animation
      if (heatmapEnabled && heatmapTimeFilter) {
        validPlaces = validPlaces.filter(p => p.date && p.date.startsWith(heatmapTimeFilter))
      }

      const bounds: [number, number][] = []

      if (heatmapEnabled) {
        // ---- HEATMAP MODE ----
        // Build heat data: [lat, lng, intensity]
        // Intensity = 1 by default; boosted slightly for rated places
        const heatData: [number, number, number][] = validPlaces.map(p => {
          const intensity = p.rating ? Math.min(p.rating / 5, 1) * 0.8 + 0.2 : 0.5
          return [p.coordinates.lat, p.coordinates.lng, intensity]
        })

        const heatLayer = (L as any).heatLayer(heatData, {
          radius: 25,
          blur: 20,
          maxZoom: 17,
          max: 1.0,
          gradient: {
            0.0: '#0d0d2b',
            0.2: '#1a1a6e',
            0.4: '#6d28d9',
            0.6: '#a855f7',
            0.8: '#f59e0b',
            1.0: '#ffffff',
          },
          minOpacity: 0.35,
        })

        map.addLayer(heatLayer)
        heatLayerRef.current = heatLayer

        // Still add labeled places on top
        for (const label of labeledPlaces) {
          if (!label.coordinates.lat && !label.coordinates.lng) continue
          const icon = (L as any).divIcon({
            html: `<div style="
              width: 10px; height: 10px; border-radius: 2px;
              background: #ef4444; border: 2px solid #fff;
              transform: rotate(45deg); box-shadow: 0 1px 4px rgba(0,0,0,0.5);
            "></div>`,
            iconSize: [10, 10], iconAnchor: [5, 5], className: 'custom-marker',
          })
          const marker = (L as any).marker([label.coordinates.lat, label.coordinates.lng], { icon })
            .addTo(map)
            .bindTooltip(`📌 ${label.name}`, { permanent: false, direction: 'top', offset: [0, -8] })
          labelMarkersRef.current.push(marker)
          bounds.push([label.coordinates.lat, label.coordinates.lng])
        }

        validPlaces.forEach(p => bounds.push([p.coordinates.lat, p.coordinates.lng]))
      } else {
        // ---- MARKER / CLUSTER MODE ----
        // Create a cluster group with custom icon generator
        const clusterGroup = (L as any).markerClusterGroup({
          disableClusteringAtZoom: clusteringEnabled ? undefined : 0,
          maxClusterRadius: 60,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount()
            let size = 36
            let fontSize = 12
            if (count >= 100) { size = 48; fontSize = 13 }
            else if (count >= 10) { size = 42; fontSize = 12 }

            return (L as any).divIcon({
              html: `<div style="
                width: ${size}px; height: ${size}px; border-radius: 50%;
                background: rgba(99,102,241,0.85); border: 2px solid rgba(255,255,255,0.8);
                box-shadow: 0 2px 8px rgba(0,0,0,0.5); display: flex;
                align-items: center; justify-content: center;
                color: #fff; font-size: ${fontSize}px; font-weight: 700; font-family: sans-serif;
              ">${count}</div>`,
              iconSize: [size, size], iconAnchor: [size / 2, size / 2], className: 'custom-cluster-icon',
            })
          },
        })

        for (const place of validPlaces) {
          const color = getListColor(place.list)
          const icon = (L as any).divIcon({
            html: `<div style="
              width: 12px; height: 12px; border-radius: 50%;
              background: ${color}; border: 2px solid rgba(255,255,255,0.8);
              box-shadow: 0 1px 4px rgba(0,0,0,0.5);
            "></div>`,
            iconSize: [12, 12], iconAnchor: [6, 6], className: 'custom-marker',
          })

          const marker = (L as any).marker(
            [place.coordinates.lat, place.coordinates.lng],
            { icon }
          ).on('click', () => {
            setSelectedPlace(place)
            onSelectPlace?.(place)
          })

          marker.bindTooltip(place.name, {
            permanent: false, direction: 'top', offset: [0, -8], className: 'custom-tooltip',
          })

          clusterGroup.addLayer(marker)
          bounds.push([place.coordinates.lat, place.coordinates.lng])
        }

        map.addLayer(clusterGroup)
        clusterGroupRef.current = clusterGroup

        // Labeled places — separate layer, not clustered
        for (const label of labeledPlaces) {
          if (!label.coordinates.lat && !label.coordinates.lng) continue
          const icon = (L as any).divIcon({
            html: `<div style="
              width: 10px; height: 10px; border-radius: 2px;
              background: #ef4444; border: 2px solid #fff;
              transform: rotate(45deg); box-shadow: 0 1px 4px rgba(0,0,0,0.5);
            "></div>`,
            iconSize: [10, 10], iconAnchor: [5, 5], className: 'custom-marker',
          })
          const marker = (L as any).marker([label.coordinates.lat, label.coordinates.lng], { icon })
            .addTo(map)
            .bindTooltip(`📌 ${label.name}`, { permanent: false, direction: 'top', offset: [0, -8] })
          labelMarkersRef.current.push(marker)
          bounds.push([label.coordinates.lat, label.coordinates.lng])
        }
      }

      // Fit to all markers
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
      }
    })
  }, [places, labeledPlaces, mapLoaded, clusteringEnabled, heatmapEnabled, heatmapTimeFilter])

  return (
    <div className="h-full relative" style={{ minHeight: '400px' }}>
      <div ref={mapRef} className="absolute inset-0" style={{ height: '100%', width: '100%' }} />

      {/* Fly-to toast notification */}
      {flyToast && (
        <div
          data-testid="fly-toast"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-[1001] pointer-events-none"
          style={{
            animation: 'fadeInDown 0.3s ease-out',
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shadow-2xl"
            style={{
              background: 'rgba(168,85,247,0.92)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
              maxWidth: '280px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span>✈️</span>
            <span className="truncate">Flying to {flyToast}</span>
          </div>
        </div>
      )}

      {/* Google Maps-style floating search bar */}
      {data && filters && onFiltersChange && (
        <SearchBar
          data={data}
          filters={filters}
          onFiltersChange={onFiltersChange}
          focusTrigger={searchFocusTrigger}
          onPlaceSelect={(place) => {
            setSelectedPlace(place)
            onSelectPlace?.(place)
            if (mapInstanceRef.current && place.coordinates.lat && place.coordinates.lng) {
              mapInstanceRef.current.flyTo(
                [place.coordinates.lat, place.coordinates.lng],
                16,
                { duration: 1.5 }
              )
            }
          }}
        />
      )}

      {/* Map controls toolbar */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Map style switcher */}
        <div className="relative">
          <button
            onClick={() => setStyleMenuOpen(v => !v)}
            title="Change map style"
            data-testid="map-style-toggle"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shadow-lg transition-colors"
            style={{
              background: 'rgba(30,30,30,0.85)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <span>{MAP_STYLES.find(s => s.id === mapStyleId)?.icon ?? '🗺️'}</span>
            <span>{MAP_STYLES.find(s => s.id === mapStyleId)?.label ?? 'Style'}</span>
            <span style={{ fontSize: '8px', opacity: 0.7 }}>▼</span>
          </button>

          {styleMenuOpen && (
            <div
              data-testid="map-style-menu"
              className="absolute top-full right-0 mt-1 rounded-xl overflow-hidden shadow-2xl"
              style={{
                background: 'rgba(20,20,30,0.97)',
                border: '1px solid rgba(255,255,255,0.15)',
                minWidth: '130px',
              }}
            >
              {MAP_STYLES.map(style => (
                <button
                  key={style.id}
                  data-testid={`map-style-option-${style.id}`}
                  onClick={() => {
                    setMapStyleId(style.id)
                    setStyleMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/10"
                  style={{
                    color: mapStyleId === style.id ? '#a855f7' : '#e5e7eb',
                    background: mapStyleId === style.id ? 'rgba(168,85,247,0.15)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span>{style.icon}</span>
                  <span>{style.label}</span>
                  {mapStyleId === style.id && <span style={{ marginLeft: 'auto' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap toggle */}
        <button
          onClick={() => setHeatmapEnabled(v => !v)}
          title={heatmapEnabled ? 'Switch to markers' : 'Show density heatmap'}
          data-testid="heatmap-toggle"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shadow-lg transition-colors"
          style={{
            background: heatmapEnabled
              ? 'rgba(168,85,247,0.9)'
              : 'rgba(30,30,30,0.85)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <span>🔥</span>
          {heatmapEnabled ? 'Heatmap' : 'Heatmap'}
        </button>

        {/* Heatmap time slider (only visible when heatmap is on) */}
        {heatmapEnabled && availableMonths.length >= 2 && (
          <div
            className="rounded-lg shadow-lg p-2"
            style={{ background: 'rgba(30,30,30,0.9)', border: '1px solid rgba(255,255,255,0.15)', minWidth: '140px' }}
            data-testid="heatmap-time-slider"
          >
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={toggleAnimation}
                className="text-xs px-2 py-0.5 rounded-md transition-colors"
                style={{
                  background: isAnimating ? 'rgba(168,85,247,0.8)' : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
                data-testid="heatmap-animate-btn"
              >
                {isAnimating ? '⏸ Stop' : '▶ Play'}
              </button>
              <span className="text-[10px] text-white/70">
                {heatmapTimeFilter || 'All time'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={availableMonths.length}
              value={heatmapTimeFilter ? availableMonths.indexOf(heatmapTimeFilter) + 1 : 0}
              onChange={(e) => {
                const idx = parseInt(e.target.value)
                if (idx === 0) {
                  setHeatmapTimeFilter(null)
                } else {
                  setHeatmapTimeFilter(availableMonths[idx - 1])
                }
                // Stop animation if user manually moves slider
                if (isAnimating) {
                  if (animationRef.current) clearInterval(animationRef.current)
                  animationRef.current = null
                  setIsAnimating(false)
                }
              }}
              className="w-full h-1 accent-purple-500"
              style={{ cursor: 'pointer' }}
              data-testid="heatmap-time-range"
            />
          </div>
        )}

        {/* Cluster toggle (only visible when heatmap is off) */}
        {!heatmapEnabled && (
          <button
            onClick={() => setClusteringEnabled(v => !v)}
            title={clusteringEnabled ? 'Disable clustering' : 'Enable clustering'}
            data-testid="cluster-toggle"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shadow-lg transition-colors"
            style={{
              background: clusteringEnabled
                ? 'rgba(99,102,241,0.9)'
                : 'rgba(30,30,30,0.85)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <span>{clusteringEnabled ? '⬡' : '•'}</span>
            {clusteringEnabled ? 'Clustered' : 'All pins'}
          </button>
        )}

        {/* Map export as PNG */}
        <button
          onClick={async () => {
            if (!mapRef.current) return
            try {
              const html2canvas = (await import('html2canvas')).default
              const canvas = await html2canvas(mapRef.current, {
                useCORS: true,
                allowTaint: true,
                scale: 2,
              })
              const link = document.createElement('a')
              link.download = `map-export-${new Date().toISOString().slice(0, 10)}.png`
              link.href = canvas.toDataURL('image/png')
              link.click()
            } catch {
              // fallback: alert user
              alert('Could not export map. Try again or use a screenshot tool.')
            }
          }}
          title="Export map as PNG"
          data-testid="map-export-png"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shadow-lg transition-colors"
          style={{
            background: 'rgba(30,30,30,0.85)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <span>📷</span>
          Export
        </button>
      </div>

      {/* Place detail panel */}
      {selectedPlace && (
        <div className="absolute bottom-4 left-4 right-4 max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-2xl z-[1000]">
          <button
            onClick={() => setSelectedPlace(null)}
            className="absolute top-2 right-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-lg leading-none"
          >
            ×
          </button>
          <div className="flex items-start gap-3">
            <span
              className="mt-1 w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: getListColor(selectedPlace.list) }}
            />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">{selectedPlace.name}</h3>
              {selectedPlace.address && (
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
                  {selectedPlace.address}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                  {selectedPlace.list}
                </span>
                {selectedPlace.rating && (
                  <span className="text-[10px]">⭐ {selectedPlace.rating}/5</span>
                )}
                {selectedPlace.date && (
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {new Date(selectedPlace.date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {selectedPlace.note && (
                <p className="text-xs text-[var(--muted-foreground)] mt-2 italic">
                  &ldquo;{selectedPlace.note}&rdquo;
                </p>
              )}
              {selectedPlace.reviewText && (
                <p className="text-xs text-[var(--muted-foreground)] mt-2">
                  {selectedPlace.reviewText}
                </p>
              )}
              {selectedPlace.url && (
                <a
                  href={selectedPlace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-[var(--primary)] hover:underline"
                >
                  Open in Google Maps →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom styles */}
      <style jsx global>{`
        @keyframes flyPulse {
          0%   { box-shadow: 0 0 0 0 rgba(168,85,247,0.7); transform: scale(1); }
          50%  { box-shadow: 0 0 0 16px rgba(168,85,247,0); transform: scale(1.3); }
          100% { box-shadow: 0 0 0 0 rgba(168,85,247,0); transform: scale(1); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .fly-pulse-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-marker,
        .custom-cluster-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-tooltip {
          background: var(--card) !important;
          color: var(--foreground) !important;
          border: 1px solid var(--border) !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        }
        .custom-tooltip::before {
          border-top-color: var(--border) !important;
        }
        .leaflet-control-zoom a {
          background: var(--card) !important;
          color: var(--foreground) !important;
          border-color: var(--border) !important;
        }
        .leaflet-control-attribution {
          background: rgba(10,10,10,0.8) !important;
          color: var(--muted-foreground) !important;
        }
        .leaflet-control-attribution a {
          color: var(--primary) !important;
        }
        /* markercluster default overrides (hide default icons) */
        .marker-cluster-small,
        .marker-cluster-medium,
        .marker-cluster-large {
          background: transparent !important;
        }
        .marker-cluster-small div,
        .marker-cluster-medium div,
        .marker-cluster-large div {
          background: transparent !important;
        }
      `}</style>
    </div>
  )
}
