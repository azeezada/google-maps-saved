'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { ParsedData, ViewMode, FilterState, Place, PhotoMeta } from '@/lib/types'
import { defaultFilters, filterPlaces } from '@/lib/filters'
import { UploadScreen } from '@/components/UploadScreen'
import { Sidebar } from '@/components/Sidebar'
import { MapView } from '@/components/MapView'
import { ListView } from '@/components/ListView'
import { AnalyticsView } from '@/components/AnalyticsView'
import { TripsView } from '@/components/TripsView'
import { CompareView } from '@/components/CompareView'
import { DiaryView } from '@/components/DiaryView'
import { FoodMapView } from '@/components/FoodMapView'
import { ItineraryView } from '@/components/ItineraryView'
import { QuizView } from '@/components/QuizView'
import { Header } from '@/components/Header'
import { PlaceDetailModal } from '@/components/PlaceDetailModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { matchPhotosToPlaces } from '@/lib/photos'
import {
  startGeocodingQueue,
  pruneStaleCacheEntries,
  type GeocodingProgress,
  type GeoCoords,
} from '@/lib/geocoding'
import { mergeParsedData } from '@/lib/merge'
import { MultiFileManager, type LoadedFile } from '@/components/MultiFileManager'
import { saveOfflineData } from '@/lib/offlineStorage'

/** Returns true if the current window is below the 'sm' breakpoint (640px). */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)')
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}

/** Load/save visited place IDs from localStorage */
function useVisitedPlaces() {
  const [visited, setVisited] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const stored = localStorage.getItem('gmsa-visited-places')
      if (stored) setVisited(new Set(JSON.parse(stored)))
    } catch { /* ignore */ }
  }, [])

  const toggle = useCallback((placeId: string) => {
    setVisited(prev => {
      const next = new Set(prev)
      if (next.has(placeId)) next.delete(placeId)
      else next.add(placeId)
      try {
        localStorage.setItem('gmsa-visited-places', JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  return { visited, toggle }
}

export default function Home() {
  const [data, setData] = useState<ParsedData | null>(null)
  /** All loaded ZIPs (primary + any extras added via MultiFileManager) */
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  // Incrementing this triggers focus on the map search bar
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0)
  // When set, MapView will fly to this place
  const [flyToPlace, setFlyToPlace] = useState<Place | null>(null)

  const isMobile = useIsMobile()
  const { visited, toggle: toggleVisited } = useVisitedPlaces()

  // On mobile, default sidebar to closed; on desktop keep it open
  useEffect(() => {
    setSidebarOpen(!isMobile)
  }, [isMobile])

  // Map of placeId → resolved coords for CSV places
  const [resolvedCoords, setResolvedCoords] = useState<Record<string, GeoCoords>>({})
  const [geocodingProgress, setGeocodingProgress] = useState<GeocodingProgress | null>(null)
  const cancelGeocodingRef = useRef<(() => void) | null>(null)

  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — not critical
      })
    }
  }, [])

  // Offline data is saved to IndexedDB via saveOfflineData() when data is loaded,
  // and served by the service worker for offline access. We intentionally do NOT
  // auto-restore from IndexedDB on mount to avoid interfering with the normal
  // upload flow (users should always see the upload screen on fresh page load).

  // Global keyboard shortcuts (only when data is loaded):
  // - Cmd+K: switch to map view and focus search
  // - Esc: close sidebar on mobile
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (e.key === 'Escape') {
        // Close modal first, then sidebar
        if (selectedPlace) {
          setSelectedPlace(null)
          return
        }
        // Close mobile sidebar
        if (isMobile && sidebarOpen) {
          setSidebarOpen(false)
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (!data) return
        e.preventDefault()
        // Switch to map view so the search bar is visible
        setViewMode('map')
        // Trigger focus on the map SearchBar
        setSearchFocusTrigger(n => n + 1)
        return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [data, isMobile, sidebarOpen, selectedPlace])

  const handleDataLoaded = useCallback((parsedData: ParsedData, fileName?: string) => {
    setData(parsedData)
    setLoadedFiles([{ name: fileName ?? 'demo-data', data: parsedData, placeCount: parsedData.places.length }])
    // Cache data for offline access
    saveOfflineData(parsedData).catch(() => {})
    setResolvedCoords({})
    setGeocodingProgress(null)
    if (cancelGeocodingRef.current) {
      cancelGeocodingRef.current()
      cancelGeocodingRef.current = null
    }
  }, [])

  /** Add an extra ZIP and re-merge all loaded datasets */
  const handleFileAdded = useCallback((file: LoadedFile) => {
    setLoadedFiles(prev => [...prev, file])
  }, [])

  /** Remove a file by index (index 0 = primary, cannot be removed via this) */
  const handleFileRemoved = useCallback((index: number) => {
    if (index === 0) return // primary file cannot be removed
    setLoadedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Re-merge whenever loadedFiles changes (after initial load)
  useEffect(() => {
    if (loadedFiles.length === 0) return
    if (loadedFiles.length === 1) {
      // Restore original single-file data (no dedup)
      setData(loadedFiles[0].data)
    } else {
      const merged = mergeParsedData(loadedFiles.map(f => f.data))
      setData(merged)
    }
    setResolvedCoords({})
    setGeocodingProgress(null)
    if (cancelGeocodingRef.current) {
      cancelGeocodingRef.current()
      cancelGeocodingRef.current = null
    }
  }, [loadedFiles]) // eslint-disable-line react-hooks/exhaustive-deps

  // Start geocoding queue whenever data changes
  useEffect(() => {
    if (!data) return

    // Clean stale cache entries on first load
    pruneStaleCacheEntries()

    // Find CSV places that need geocoding
    const csvItems = data.places.filter(
      p => p.source === 'csv_list' && p.coordinates.lat === 0 && p.coordinates.lng === 0
    )

    if (csvItems.length === 0) return

    const cancel = startGeocodingQueue(
      csvItems.map(p => ({ id: p.id, name: p.name, url: p.url })),
      (placeId, coords) => {
        if (coords) {
          setResolvedCoords(prev => ({ ...prev, [placeId]: coords }))
        }
      },
      progress => setGeocodingProgress(progress),
    )

    cancelGeocodingRef.current = cancel

    return () => {
      cancel()
    }
  }, [data])

  // Match photos to places
  const photoMap = useMemo<Map<string, PhotoMeta[]>>(() => {
    if (!data || data.photos.length === 0) return new Map()
    return matchPhotosToPlaces(data.photos, data.places)
  }, [data])

  if (!data) {
    return <UploadScreen onDataLoaded={handleDataLoaded} />
  }

  // Merge resolved coords into places before filtering
  const placesWithCoords: Place[] = data.places.map(p => {
    const resolved = resolvedCoords[p.id]
    if (resolved) {
      return { ...p, coordinates: resolved }
    }
    return p
  })

  const enrichedData: ParsedData = { ...data, places: placesWithCoords }
  const filteredPlaces = filterPlaces(placesWithCoords, filters)

  const handleToggleSidebar = () => setSidebarOpen(open => !open)
  const handleCloseSidebar = () => setSidebarOpen(false)

  /**
   * When a place is clicked from ListView (or PlaceDetailModal "View on Map" button),
   * open the modal, switch to map view, and fly to the place.
   */
  const handleViewOnMap = (place: Place) => {
    setSelectedPlace(place)
    setViewMode('map')
    setFlyToPlace(place)
  }

  // On mobile the sidebar is a fixed overlay; on desktop it's an inline panel
  const showSidebar = sidebarOpen
  const showBackdrop = isMobile && sidebarOpen

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalPlaces={data.places.length}
        filteredPlaces={filteredPlaces.length}
        filteredPlacesList={filteredPlaces}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        geocodingProgress={geocodingProgress}
        loadedFiles={loadedFiles}
        onFileAdded={handleFileAdded}
        onFileRemoved={handleFileRemoved}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile backdrop */}
        {showBackdrop && (
          <div
            className="fixed inset-0 z-30 bg-black/40 sm:hidden"
            onClick={handleCloseSidebar}
            aria-hidden="true"
            data-testid="sidebar-backdrop"
          />
        )}

        {/* Sidebar — inline on desktop, overlay on mobile */}
        {showSidebar && (
          <Sidebar
            data={enrichedData}
            filters={filters}
            onFiltersChange={setFilters}
            filteredCount={filteredPlaces.length}
            onClose={handleCloseSidebar}
            isMobileOverlay={isMobile}
          />
        )}

        {/* Main content always fills remaining space */}
        <main className="flex-1 overflow-hidden relative" aria-label={`${viewMode} view`} style={{ minHeight: 0 }}>
          {viewMode === 'map' && (
            <ErrorBoundary fallbackLabel="Map View">
              <MapView
                places={filteredPlaces}
                labeledPlaces={data.labeledPlaces}
                data={enrichedData}
                filters={filters}
                onFiltersChange={setFilters}
                searchFocusTrigger={searchFocusTrigger}
                onSelectPlace={setSelectedPlace}
                flyToPlace={flyToPlace}
                onFlyComplete={() => setFlyToPlace(null)}
              />
            </ErrorBoundary>
          )}
          {viewMode === 'list' && (
            <ErrorBoundary fallbackLabel="List View">
              <ListView
                places={filteredPlaces}
                onSelectPlace={setSelectedPlace}
                onViewOnMap={handleViewOnMap}
                visited={visited}
                onToggleVisited={toggleVisited}
              />
            </ErrorBoundary>
          )}
          {viewMode === 'analytics' && (
            <ErrorBoundary fallbackLabel="Analytics View">
              <AnalyticsView data={enrichedData} filteredPlaces={filteredPlaces} photoMap={photoMap} />
            </ErrorBoundary>
          )}
          {viewMode === 'trips' && (
            <ErrorBoundary fallbackLabel="Trips View">
              <TripsView data={enrichedData} filteredPlaces={filteredPlaces} />
            </ErrorBoundary>
          )}
          {viewMode === 'compare' && (
            <ErrorBoundary fallbackLabel="Compare View">
              <CompareView data={enrichedData} />
            </ErrorBoundary>
          )}
          {viewMode === 'diary' && (
            <ErrorBoundary fallbackLabel="Diary View">
              <DiaryView data={enrichedData} filteredPlaces={filteredPlaces} />
            </ErrorBoundary>
          )}
          {viewMode === 'food' && (
            <ErrorBoundary fallbackLabel="Food Map View">
              <FoodMapView places={filteredPlaces} onSelectPlace={setSelectedPlace} onViewOnMap={handleViewOnMap} />
            </ErrorBoundary>
          )}
          {viewMode === 'itinerary' && (
            <ErrorBoundary fallbackLabel="Itinerary View">
              <ItineraryView data={enrichedData} filteredPlaces={filteredPlaces} onSelectPlace={setSelectedPlace} />
            </ErrorBoundary>
          )}
          {viewMode === 'quiz' && (
            <ErrorBoundary fallbackLabel="Quiz View">
              <QuizView data={enrichedData} filteredPlaces={filteredPlaces} onSelectPlace={setSelectedPlace} />
            </ErrorBoundary>
          )}
        </main>
      </div>

      {/* Place detail modal — rendered at top level for proper z-index stacking */}
      <PlaceDetailModal
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onViewOnMap={handleViewOnMap}
        photoMap={photoMap}
        visited={visited}
        onToggleVisited={toggleVisited}
      />
    </div>
  )
}
