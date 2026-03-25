'use client'

import { useEffect, useRef } from 'react'
import { X, MapPin, Calendar, Star, Tag, ExternalLink, List, Globe, FileText, MessageSquare, Map, CheckCircle2, Camera, Share2 } from 'lucide-react'
import type { Place, PhotoMeta } from '@/lib/types'
import { getListColor } from './Sidebar'
import { getCategoryInfo } from '@/lib/categories'
import type { PlaceCategory } from '@/lib/categories'
import { StreetViewThumbnail } from './StreetViewThumbnail'

interface PlaceDetailModalProps {
  place: Place | null
  onClose: () => void
  /** Called when user clicks "View on Map" — switches to map view + flies to place */
  onViewOnMap?: (place: Place) => void
  /** Photo map: placeId → matched photos */
  photoMap?: Map<string, PhotoMeta[]>
  /** Set of visited place IDs */
  visited?: Set<string>
  /** Toggle visited status */
  onToggleVisited?: (placeId: string) => void
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" data-testid="place-rating-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-[var(--muted-foreground)]'}`}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{rating}/5</span>
    </span>
  )
}

const SOURCE_LABELS: Record<Place['source'], string> = {
  saved_places: 'Saved Places',
  csv_list: 'List',
  review: 'Review',
  labeled: 'Labeled',
}

const SOURCE_COLORS: Record<Place['source'], string> = {
  saved_places: 'bg-blue-500/20 text-blue-300',
  csv_list: 'bg-purple-500/20 text-purple-300',
  review: 'bg-green-500/20 text-green-300',
  labeled: 'bg-red-500/20 text-red-300',
}

export function PlaceDetailModal({ place, onClose, onViewOnMap, photoMap, visited, onToggleVisited }: PlaceDetailModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // Close on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (place) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [place])

  if (!place) return null

  const listColor = getListColor(place.list)
  const photos = photoMap?.get(place.id) ?? []
  const isVisited = visited?.has(place.id) ?? false

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleShare = () => {
    const params = new URLSearchParams()
    params.set('name', place.name)
    if (place.coordinates.lat !== 0 || place.coordinates.lng !== 0) {
      params.set('lat', place.coordinates.lat.toFixed(5))
      params.set('lng', place.coordinates.lng.toFixed(5))
    }
    if (place.city) params.set('city', place.city)
    if (place.country) params.set('country', place.country)
    const shareUrl = `${window.location.origin}${window.location.pathname}#place=${params.toString()}`
    navigator.clipboard?.writeText(shareUrl)
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      data-testid="place-detail-backdrop"
      onClick={handleBackdropClick}
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        animation: 'modal-fade-in 0.15s ease-out',
      }}
    >
      <div
        ref={cardRef}
        data-testid="place-detail-modal"
        className="relative w-full sm:max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ animation: 'modal-scale-in 0.15s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 pb-3 border-b border-[var(--border)] shrink-0">
          <span
            className="mt-1 w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: listColor }}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold leading-snug pr-16" data-testid="place-detail-name">
              {place.name}
            </h2>
            {(place.city || place.country) && (
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {[place.city, place.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-1">
            {onToggleVisited && (
              <button
                onClick={() => onToggleVisited(place.id)}
                data-testid="place-visited-toggle"
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                  isVisited
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]'
                }`}
                aria-label={isVisited ? 'Mark as not visited' : 'Mark as visited'}
                title={isVisited ? 'Visited' : 'Mark as visited'}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              data-testid="place-detail-close"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Street View thumbnail — shown when the place has real coordinates */}
          {place.coordinates.lat !== 0 && place.coordinates.lng !== 0 && (
            <StreetViewThumbnail
              lat={place.coordinates.lat}
              lng={place.coordinates.lng}
              name={place.name}
              width={400}
              height={200}
              className="w-full"
            />
          )}

          {/* Matched photos */}
          {photos.length > 0 && (
            <div data-testid="place-photos-section">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                  {photos.length} matched photo{photos.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {photos.slice(0, 8).map(photo => (
                  <div
                    key={photo.id}
                    className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs"
                    data-testid="place-photo-item"
                  >
                    <p className="font-medium truncate max-w-[180px]">{photo.title}</p>
                    {photo.takenAt && (
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                        {new Date(photo.takenAt).toLocaleDateString()}
                      </p>
                    )}
                    {photo.album && (
                      <p className="text-[10px] text-[var(--muted-foreground)]">{photo.album}</p>
                    )}
                  </div>
                ))}
                {photos.length > 8 && (
                  <span className="text-xs text-[var(--muted-foreground)] self-center">
                    +{photos.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Visited badge */}
          {isVisited && (
            <div className="flex items-center gap-2 text-green-400 text-xs" data-testid="place-visited-badge">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">You've visited this place</span>
            </div>
          )}

          {/* Badges row: list + source + category */}
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: listColor }}
            >
              <List className="w-3 h-3" />
              {place.list}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${SOURCE_COLORS[place.source]}`}>
              <FileText className="w-3 h-3" />
              {SOURCE_LABELS[place.source]}
            </span>
            {place.category && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)]"
                data-testid="place-category-badge"
                title="Inferred category"
              >
                {getCategoryInfo(place.category as PlaceCategory).emoji}{' '}
                {getCategoryInfo(place.category as PlaceCategory).label}
              </span>
            )}
          </div>

          {/* Address */}
          {place.address && (
            <div className="flex gap-2.5">
              <MapPin className="w-4 h-4 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--foreground)]">{place.address}</p>
            </div>
          )}

          {/* Date saved */}
          {place.date && (
            <div className="flex gap-2.5 items-center">
              <Calendar className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-sm text-[var(--muted-foreground)]">
                Saved {new Date(place.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          )}

          {/* Rating */}
          {place.rating != null && (
            <div className="flex gap-2.5 items-center">
              <Star className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
              <StarRating rating={place.rating} />
            </div>
          )}

          {/* Review text */}
          {place.reviewText && (
            <div className="flex gap-2.5">
              <MessageSquare className="w-4 h-4 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-1 font-medium uppercase tracking-wide">Review</p>
                <p className="text-sm text-[var(--foreground)] leading-relaxed">{place.reviewText}</p>
              </div>
            </div>
          )}

          {/* Note */}
          {place.note && (
            <div className="flex gap-2.5">
              <FileText className="w-4 h-4 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-1 font-medium uppercase tracking-wide">Note</p>
                <p className="text-sm italic text-[var(--foreground)] leading-relaxed">&ldquo;{place.note}&rdquo;</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {place.tags && place.tags.length > 0 && (
            <div className="flex gap-2.5">
              <Tag className="w-4 h-4 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1.5">
                {place.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md text-xs bg-[var(--muted)] text-[var(--muted-foreground)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Coordinates */}
          {place.coordinates && (place.coordinates.lat !== 0 || place.coordinates.lng !== 0) && (
            <div className="flex gap-2.5 items-center">
              <Globe className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-xs text-[var(--muted-foreground)] font-mono">
                {place.coordinates.lat.toFixed(5)}, {place.coordinates.lng.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        {/* Footer: View on Map + Share + Google Maps link */}
        <div className="shrink-0 px-5 py-4 border-t border-[var(--border)] flex flex-col gap-2">
          {onViewOnMap && place.coordinates.lat !== 0 && place.coordinates.lng !== 0 && (
            <button
              data-testid="place-detail-view-on-map"
              onClick={() => { onClose(); onViewOnMap(place) }}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--border)] transition-colors"
            >
              <Map className="w-4 h-4" />
              View on Map
            </button>
          )}
          <button
            data-testid="place-share-btn"
            onClick={handleShare}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--border)] transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Copy Share Link
          </button>
          {place.url && (
            <a
              href={place.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="place-google-maps-link"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Google Maps
            </a>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-scale-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
