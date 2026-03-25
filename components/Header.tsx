'use client'

import { useState } from 'react'
import { Map, List, BarChart3, PanelLeftClose, PanelLeftOpen, Loader2, FileText, FileJson, Plane, Columns2, BookOpen, UtensilsCrossed, CalendarDays, BrainCircuit, Printer, Download, ChevronDown } from 'lucide-react'
import type { ViewMode, Place } from '@/lib/types'
import type { GeocodingProgress } from '@/lib/geocoding'
import { exportCsv, exportJson, exportFilename } from '@/lib/export'
import { exportGpx, exportKml } from '@/lib/exportFormats'
import { MultiFileManager, type LoadedFile } from '@/components/MultiFileManager'

interface HeaderProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  totalPlaces: number
  filteredPlaces: number
  filteredPlacesList?: Place[]
  sidebarOpen: boolean
  onToggleSidebar: () => void
  geocodingProgress?: GeocodingProgress | null
  /** Multi-file support */
  loadedFiles?: LoadedFile[]
  onFileAdded?: (file: LoadedFile) => void
  onFileRemoved?: (index: number) => void
}

const viewModes: { id: ViewMode; label: string; icon: typeof Map }[] = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'list', label: 'List', icon: List },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'trips', label: 'Trips', icon: Plane },
  { id: 'compare', label: 'Compare', icon: Columns2 },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'food', label: 'Food', icon: UtensilsCrossed },
  { id: 'itinerary', label: 'Itinerary', icon: CalendarDays },
  { id: 'quiz', label: 'Quiz', icon: BrainCircuit },
]

export function Header({
  viewMode,
  onViewModeChange,
  totalPlaces,
  filteredPlaces,
  filteredPlacesList,
  sidebarOpen,
  onToggleSidebar,
  geocodingProgress,
  loadedFiles,
  onFileAdded,
  onFileRemoved,
}: HeaderProps) {
  const showGeoProgress =
    geocodingProgress && geocodingProgress.total > 0

  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const handleExportCsv = () => {
    if (!filteredPlacesList || filteredPlacesList.length === 0) return
    exportCsv(filteredPlacesList, exportFilename('places', 'csv'))
    setExportMenuOpen(false)
  }

  const handleExportJson = () => {
    if (!filteredPlacesList || filteredPlacesList.length === 0) return
    exportJson(filteredPlacesList, exportFilename('places', 'json'))
    setExportMenuOpen(false)
  }

  const handleExportGpx = () => {
    if (!filteredPlacesList || filteredPlacesList.length === 0) return
    exportGpx(filteredPlacesList, exportFilename('places', 'gpx'))
    setExportMenuOpen(false)
  }

  const handleExportKml = () => {
    if (!filteredPlacesList || filteredPlacesList.length === 0) return
    exportKml(filteredPlacesList, exportFilename('places', 'kml'))
    setExportMenuOpen(false)
  }

  const hasPlaces = filteredPlacesList && filteredPlacesList.length > 0

  return (
    <header className="h-12 sm:h-14 border-b border-[var(--border)] bg-[var(--card)] flex items-center justify-between px-2 sm:px-4 shrink-0 gap-2">
      {/* Left: sidebar toggle + title + count */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-[var(--muted)] transition-colors shrink-0"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          data-testid="sidebar-toggle"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted-foreground)]" />
          ) : (
            <PanelLeftOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted-foreground)]" />
          )}
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base sm:text-lg">📍</span>
          {/* Title hidden on very small screens to save space */}
          <h1 className="hidden sm:block text-sm font-semibold tracking-tight truncate">Places Analyzer</h1>
        </div>

        <span
          data-testid="place-count-badge"
          className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap"
        >
          {filteredPlaces === totalPlaces ? (
            <>
              {totalPlaces}
              <span className="hidden sm:inline"> places</span>
            </>
          ) : (
            <>
              {filteredPlaces}
              <span className="hidden sm:inline"> / {totalPlaces}</span>
              <span className="sm:hidden">/{totalPlaces}</span>
            </>
          )}
        </span>

        {/* Geocoding progress — hidden on xs, visible sm+ */}
        {showGeoProgress && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            {geocodingProgress.isRunning ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-[var(--primary)]" />
                <span className="text-[var(--primary)] font-medium">
                  {geocodingProgress.completed}/{geocodingProgress.total}
                </span>
              </>
            ) : (
              <span>✓ {geocodingProgress.completed - geocodingProgress.failed}/{geocodingProgress.total}</span>
            )}
          </div>
        )}
      </div>

      {/* Right: multi-file + export + view mode nav */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Multi-file manager */}
        {loadedFiles && onFileAdded && onFileRemoved && (
          <div className="relative">
            <MultiFileManager
              files={loadedFiles}
              onFileAdded={onFileAdded}
              onFileRemoved={onFileRemoved}
            />
          </div>
        )}
        {/* Export dropdown */}
        {filteredPlacesList !== undefined && (
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(v => !v)}
              disabled={!hasPlaces}
              title={hasPlaces ? `Export ${filteredPlaces} places` : 'No places to export'}
              data-testid="header-export-csv"
              className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-md text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--primary)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {exportMenuOpen && (
              <div
                data-testid="export-menu"
                className="absolute top-full right-0 mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 py-1"
                onMouseLeave={() => setExportMenuOpen(false)}
              >
                <button onClick={handleExportCsv} data-testid="header-export-csv-btn" className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--muted)] transition-colors">
                  <FileText className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={handleExportJson} data-testid="header-export-json" className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--muted)] transition-colors">
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </button>
                <button onClick={handleExportGpx} data-testid="header-export-gpx" className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--muted)] transition-colors">
                  <FileText className="w-3.5 h-3.5" /> GPX (Hiking apps)
                </button>
                <button onClick={handleExportKml} data-testid="header-export-kml" className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--muted)] transition-colors">
                  <FileText className="w-3.5 h-3.5" /> KML (Google Earth)
                </button>
                <div className="border-t border-[var(--border)] my-1" />
                <button onClick={() => { window.print(); setExportMenuOpen(false) }} data-testid="header-print" className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--muted)] transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </button>
              </div>
            )}
          </div>
        )}

        {/* View mode nav */}
        <nav className="flex items-center bg-[var(--muted)] rounded-lg p-0.5" aria-label="View mode navigation">
          {viewModes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onViewModeChange(id)}
              title={label}
              data-testid={`view-${id}`}
              aria-pressed={viewMode === id}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === id
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {/* Label hidden on xs */}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
