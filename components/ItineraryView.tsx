'use client'

/**
 * Itinerary Builder
 *
 * Left pane: source places (all filtered places, defaulting to "Want to go" list).
 * Right pane: multi-day columns.
 *
 * Drag-and-drop is implemented with the HTML5 drag API (no extra deps).
 * Works on touch via pointer events fallback.
 */

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  DragEvent,
} from 'react'
import { Plus, Trash2, GripVertical, Copy, Check, RefreshCw, Pencil } from 'lucide-react'
import type { Place, ParsedData } from '@/lib/types'
import { getCategoryInfo } from '@/lib/categories'
import type { PlaceCategory } from '@/lib/categories'
import {
  type Itinerary,
  type ItineraryDay,
  loadItinerary,
  saveItinerary,
  clearItinerary,
  createItinerary,
  addDay,
  removeDay,
  movePlaceToDay,
  removePlaceFromItinerary,
  reorderPlaceWithinDay,
  renameDayLabel,
  scheduledPlaceIds,
  estimatedMinutes,
  formatDuration,
  itineraryToText,
} from '@/lib/itinerary'

// ---------------------------------------------------------------------------
// Drag state (shared via module-level refs)
// ---------------------------------------------------------------------------
interface DragPayload {
  placeId: string
  fromDayId: string | null   // null = coming from source pane
  fromIndex: number | null
}

interface DropTarget {
  dayId: string
  index: number              // insertion index inside day
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlaceChip({
  place,
  dragging,
  onDragStart,
  onDragEnd,
  onRemove,
  showRemove,
}: {
  place: Place
  dragging: boolean
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onRemove?: () => void
  showRemove: boolean
}) {
  const catInfo = place.category
    ? getCategoryInfo(place.category as PlaceCategory)
    : { emoji: '📍', label: 'Place' }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-testid="itinerary-place-chip"
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs cursor-grab active:cursor-grabbing select-none transition-all ${
        dragging
          ? 'opacity-40 scale-95 border-[var(--primary)]'
          : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)]'
      }`}
    >
      <GripVertical className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
      <span className="shrink-0">{catInfo.emoji}</span>
      <span className="flex-1 min-w-0 truncate font-medium">{place.name}</span>
      {place.city && place.city !== 'Unknown' && (
        <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 hidden sm:block">{place.city}</span>
      )}
      {showRemove && onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
          title="Remove from itinerary"
          data-testid="itinerary-remove-place"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

function DayColumn({
  day,
  places,
  onRename,
  onRemoveDay,
  onRemovePlace,
  onDragStartFromDay,
  onDragEnd,
  dragOverDayId,
  dragOverIndex,
  onDragEnterDay,
  onDropOnDay,
  currentDragPayload,
  dayIndex,
}: {
  day: ItineraryDay
  places: (Place | undefined)[]
  onRename: (label: string) => void
  onRemoveDay: () => void
  onRemovePlace: (placeId: string) => void
  onDragStartFromDay: (placeId: string, fromIndex: number) => (e: DragEvent) => void
  onDragEnd: () => void
  dragOverDayId: string | null
  dragOverIndex: number | null
  onDragEnterDay: (dayId: string, index: number) => void
  onDropOnDay: (dayId: string, index: number) => void
  currentDragPayload: DragPayload | null
  dayIndex: number
}) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelValue, setLabelValue] = useState(day.label)
  const labelInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLabelValue(day.label) }, [day.label])
  useEffect(() => {
    if (editingLabel) labelInputRef.current?.focus()
  }, [editingLabel])

  const totalMins = places.reduce((acc, p) => acc + (p ? estimatedMinutes(p.category) : 0), 0)
  const isDropTarget = dragOverDayId === day.id

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    onDragEnterDay(day.id, index)
  }

  function handleDrop(e: DragEvent, index: number) {
    e.preventDefault()
    onDropOnDay(day.id, index)
  }

  return (
    <div
      className={`flex flex-col rounded-xl border bg-[var(--muted)] transition-colors min-w-[200px] max-w-[260px] shrink-0 ${
        isDropTarget ? 'border-[var(--primary)] shadow-lg' : 'border-[var(--border)]'
      }`}
      style={{ width: 232 }}
      data-testid={`itinerary-day-column`}
      data-day-id={day.id}
    >
      {/* Column header */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2 border-b border-[var(--border)]">
        <span className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 rounded px-1.5 py-0.5 shrink-0">
          {dayIndex + 1}
        </span>
        {editingLabel ? (
          <input
            ref={labelInputRef}
            value={labelValue}
            onChange={e => setLabelValue(e.target.value)}
            onBlur={() => { setEditingLabel(false); onRename(labelValue.trim() || day.label) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { setEditingLabel(false); onRename(labelValue.trim() || day.label) }
              if (e.key === 'Escape') { setEditingLabel(false); setLabelValue(day.label) }
            }}
            className="flex-1 min-w-0 text-xs font-semibold bg-[var(--card)] border border-[var(--primary)] rounded px-1 py-0.5 outline-none"
            data-testid="itinerary-day-label-input"
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="flex-1 min-w-0 text-left text-xs font-semibold truncate hover:text-[var(--primary)] group flex items-center gap-1"
            data-testid="itinerary-day-label"
            title="Click to rename"
          >
            {day.label}
            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 shrink-0" />
          </button>
        )}
        <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">{places.filter(Boolean).length}p</span>
        <button
          onClick={onRemoveDay}
          className="shrink-0 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors"
          title="Remove day"
          data-testid="itinerary-remove-day"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Drop zones + place list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[80px]">
        {/* Drop zone at index 0 */}
        <DropZone
          dayId={day.id}
          index={0}
          isActive={isDropTarget && dragOverIndex === 0}
          onDragOver={e => handleDragOver(e, 0)}
          onDrop={e => handleDrop(e, 0)}
          isEmpty={places.length === 0}
        />

        {places.map((place, idx) => {
          if (!place) return null
          const isDragging =
            currentDragPayload?.placeId === place.id &&
            currentDragPayload?.fromDayId === day.id

          return (
            <div key={place.id}>
              <PlaceChip
                place={place}
                dragging={isDragging}
                onDragStart={onDragStartFromDay(place.id, idx)}
                onDragEnd={onDragEnd}
                onRemove={() => onRemovePlace(place.id)}
                showRemove
              />
              <DropZone
                dayId={day.id}
                index={idx + 1}
                isActive={isDropTarget && dragOverIndex === idx + 1}
                onDragOver={e => handleDragOver(e, idx + 1)}
                onDrop={e => handleDrop(e, idx + 1)}
                isEmpty={false}
              />
            </div>
          )
        })}
      </div>

      {/* Footer: total estimated time */}
      {totalMins > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border)] text-[10px] text-[var(--muted-foreground)]">
          ⏱ ~{formatDuration(totalMins)} estimated
        </div>
      )}
    </div>
  )
}

function DropZone({
  dayId,
  index,
  isActive,
  onDragOver,
  onDrop,
  isEmpty,
}: {
  dayId: string
  index: number
  isActive: boolean
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
  isEmpty: boolean
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={isEmpty ? 'itinerary-drop-zone-empty' : undefined}
      className={`rounded transition-all ${
        isActive
          ? 'h-8 bg-[var(--primary)]/20 border-2 border-dashed border-[var(--primary)]'
          : isEmpty
          ? 'h-12 border-2 border-dashed border-[var(--border)] rounded-lg flex items-center justify-center text-[10px] text-[var(--muted-foreground)]'
          : 'h-1.5'
      }`}
    >
      {isEmpty && !isActive && <span>Drop places here</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main ItineraryView
// ---------------------------------------------------------------------------

interface ItineraryViewProps {
  data: ParsedData
  filteredPlaces: Place[]
  onSelectPlace: (place: Place) => void
}

export function ItineraryView({ data, filteredPlaces, onSelectPlace }: ItineraryViewProps) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [nameInput, setNameInput] = useState('My Trip')
  const [numDaysInput, setNumDaysInput] = useState(3)
  const [copied, setCopied] = useState(false)

  // Drag state
  const [currentDrag, setCurrentDrag] = useState<DragPayload | null>(null)
  const [dragOverDayId, setDragOverDayId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Source filter — prefer "Want to go" list
  const allLists = useMemo(() => [...new Set(filteredPlaces.map(p => p.list))].sort(), [filteredPlaces])
  const defaultSourceList = useMemo(() => {
    const wantToGo = allLists.find(l => l.toLowerCase().includes('want'))
    return wantToGo ?? allLists[0] ?? 'all'
  }, [allLists])
  const [sourceFilter, setSourceFilter] = useState<string>('')

  // Initialize sourceFilter when lists are available
  useEffect(() => {
    if (!sourceFilter) setSourceFilter(defaultSourceList)
  }, [defaultSourceList, sourceFilter])

  // Load itinerary from localStorage on mount
  useEffect(() => {
    const saved = loadItinerary()
    if (saved) setItinerary(saved)
  }, [])

  // Auto-save whenever itinerary changes
  useEffect(() => {
    if (itinerary) saveItinerary(itinerary)
  }, [itinerary])

  const placeMap = useMemo(() => {
    const m = new Map<string, Place>()
    for (const p of data.places) m.set(p.id, p)
    return m
  }, [data.places])

  // Source places: filtered by selected list, excluding already-scheduled
  const scheduled = useMemo(
    () => itinerary ? scheduledPlaceIds(itinerary) : new Set<string>(),
    [itinerary],
  )

  const sourcePlaces = useMemo(() => {
    const base = sourceFilter === 'all'
      ? filteredPlaces
      : filteredPlaces.filter(p => p.list === sourceFilter)
    return base.filter(p => !scheduled.has(p.id))
  }, [filteredPlaces, sourceFilter, scheduled])

  // ---------------------------------------------------------------------------
  // Drag handlers
  // ---------------------------------------------------------------------------

  const handleDragStartSource = useCallback((placeId: string) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    setCurrentDrag({ placeId, fromDayId: null, fromIndex: null })
  }, [])

  const handleDragStartFromDay = useCallback((placeId: string, fromIndex: number) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    // Find which day
    const fromDayId = itinerary?.days.find(d => d.placeIds.includes(placeId))?.id ?? null
    setCurrentDrag({ placeId, fromDayId, fromIndex })
  }, [itinerary])

  const handleDragEnd = useCallback(() => {
    setCurrentDrag(null)
    setDragOverDayId(null)
    setDragOverIndex(null)
  }, [])

  const handleDragEnterDay = useCallback((dayId: string, index: number) => {
    setDragOverDayId(dayId)
    setDragOverIndex(index)
  }, [])

  const handleDropOnDay = useCallback((dayId: string, index: number) => {
    if (!currentDrag || !itinerary) return
    const { placeId, fromDayId, fromIndex } = currentDrag

    let next: Itinerary
    if (fromDayId === dayId && fromIndex !== null) {
      // Reorder within same day
      next = reorderPlaceWithinDay(itinerary, dayId, fromIndex, index > fromIndex ? index - 1 : index)
    } else {
      next = movePlaceToDay(itinerary, placeId, dayId, index)
    }
    setItinerary(next)
    setCurrentDrag(null)
    setDragOverDayId(null)
    setDragOverIndex(null)
  }, [currentDrag, itinerary])

  // Drop on source (remove from itinerary)
  const handleDropOnSource = useCallback((e: DragEvent) => {
    e.preventDefault()
    if (!currentDrag || !itinerary) return
    if (currentDrag.fromDayId) {
      setItinerary(removePlaceFromItinerary(itinerary, currentDrag.placeId))
    }
    setCurrentDrag(null)
    setDragOverDayId(null)
    setDragOverIndex(null)
  }, [currentDrag, itinerary])

  const handleDragOverSource = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  // ---------------------------------------------------------------------------
  // Itinerary mutations
  // ---------------------------------------------------------------------------

  const handleCreate = () => {
    const itin = createItinerary(nameInput || 'My Trip', Math.max(1, Math.min(14, numDaysInput)))
    setItinerary(itin)
  }

  const handleAddDay = () => {
    if (!itinerary) return
    setItinerary(addDay(itinerary))
  }

  const handleRemoveDay = (dayId: string) => {
    if (!itinerary) return
    setItinerary(removeDay(itinerary, dayId))
  }

  const handleRenameDay = (dayId: string, label: string) => {
    if (!itinerary) return
    setItinerary(renameDayLabel(itinerary, dayId, label))
  }

  const handleRemovePlace = (placeId: string) => {
    if (!itinerary) return
    setItinerary(removePlaceFromItinerary(itinerary, placeId))
  }

  const handleReset = () => {
    clearItinerary()
    setItinerary(null)
  }

  const handleCopyText = () => {
    if (!itinerary) return
    const text = itineraryToText(itinerary, placeMap)
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---------------------------------------------------------------------------
  // Render: no itinerary yet → creation wizard
  // ---------------------------------------------------------------------------

  if (!itinerary) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center gap-6 p-8"
        data-testid="itinerary-view"
      >
        <span className="text-5xl">🗓️</span>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-1">Itinerary Builder</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
            Drag places from your lists into a day-by-day plan. Your itinerary auto-saves to the browser.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Trip name (e.g. Tokyo 2026)"
            className="text-sm bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)]"
            data-testid="itinerary-name-input"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">Days:</label>
            <input
              type="number"
              min={1}
              max={14}
              value={numDaysInput}
              onChange={e => setNumDaysInput(Number(e.target.value))}
              className="flex-1 text-sm bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)]"
              data-testid="itinerary-days-input"
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            data-testid="itinerary-create-btn"
          >
            <Plus className="w-4 h-4" />
            Create Itinerary
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: itinerary editor
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="itinerary-view">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--card)] flex-wrap">
        <span className="text-lg">🗓️</span>
        <h2 className="text-sm font-semibold truncate max-w-[180px]" data-testid="itinerary-title">
          {itinerary.name}
        </h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {itinerary.days.length} day{itinerary.days.length !== 1 ? 's' : ''}
          {' · '}
          {scheduled.size} place{scheduled.size !== 1 ? 's' : ''} scheduled
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={handleAddDay}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--muted)] hover:bg-[var(--primary)] hover:text-white transition-colors"
            data-testid="itinerary-add-day-btn"
          >
            <Plus className="w-3.5 h-3.5" /> Day
          </button>
          <button
            onClick={handleCopyText}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--muted)] hover:bg-[var(--primary)] hover:text-white transition-colors"
            data-testid="itinerary-copy-btn"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--muted)] hover:bg-red-500/20 hover:text-red-400 transition-colors"
            title="Reset and start over"
            data-testid="itinerary-reset-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Body: source pane + day columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Source pane */}
        <div
          className="w-56 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--card)] overflow-hidden"
          onDragOver={handleDragOverSource}
          onDrop={handleDropOnSource}
          data-testid="itinerary-source-pane"
        >
          {/* Source filter */}
          <div className="px-3 pt-3 pb-2 border-b border-[var(--border)]">
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">Source</p>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="w-full text-xs bg-[var(--muted)] border border-[var(--border)] rounded-lg px-2 py-1.5 outline-none"
              data-testid="itinerary-source-filter"
              aria-label="Filter source places by list"
            >
              <option value="all">All lists</option>
              {allLists.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
              {sourcePlaces.length} unscheduled
            </p>
          </div>

          {/* Source list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sourcePlaces.length === 0 ? (
              <p className="text-[10px] text-[var(--muted-foreground)] text-center py-4 px-2">
                All places from this list are already scheduled!
              </p>
            ) : (
              sourcePlaces.map(place => (
                <PlaceChip
                  key={place.id}
                  place={place}
                  dragging={currentDrag?.placeId === place.id && currentDrag?.fromDayId === null}
                  onDragStart={handleDragStartSource(place.id)}
                  onDragEnd={handleDragEnd}
                  showRemove={false}
                />
              ))
            )}
          </div>
        </div>

        {/* Day columns — scrollable horizontally */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-4 h-full items-start min-h-full">
            {itinerary.days.map((day, dayIndex) => {
              const dayPlaces = day.placeIds.map(id => placeMap.get(id))
              return (
                <DayColumn
                  key={day.id}
                  day={day}
                  places={dayPlaces}
                  dayIndex={dayIndex}
                  onRename={label => handleRenameDay(day.id, label)}
                  onRemoveDay={() => handleRemoveDay(day.id)}
                  onRemovePlace={handleRemovePlace}
                  onDragStartFromDay={handleDragStartFromDay}
                  onDragEnd={handleDragEnd}
                  dragOverDayId={dragOverDayId}
                  dragOverIndex={dragOverIndex}
                  onDragEnterDay={handleDragEnterDay}
                  onDropOnDay={handleDropOnDay}
                  currentDragPayload={currentDrag}
                />
              )
            })}

            {/* Add day button at end of columns */}
            <button
              onClick={handleAddDay}
              className="shrink-0 self-start flex flex-col items-center justify-center gap-2 w-14 h-24 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              data-testid="itinerary-add-day-inline"
              title="Add day"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px]">Day</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
