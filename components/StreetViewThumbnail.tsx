'use client'

import { useState, useEffect, useRef } from 'react'
import { ExternalLink, Camera, KeyRound, Eye, X } from 'lucide-react'
import {
  getStreetViewUrl,
  getStreetViewDeepLink,
  getStoredApiKey,
  storeApiKey,
  clearApiKey,
  STREETVIEW_KEY_STORAGE,
} from '@/lib/streetview'

interface StreetViewThumbnailProps {
  lat: number
  lng: number
  name?: string
  /** Width for the static image (default 400) */
  width?: number
  /** Height for the static image (default 220) */
  height?: number
  /** Extra CSS class on outer container */
  className?: string
  /** Called when the key is saved/cleared (parent can re-render) */
  onApiKeyChange?: (key: string | null) => void
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'no-panorama' | 'no-key'

export function StreetViewThumbnail({
  lat,
  lng,
  name,
  width = 400,
  height = 220,
  className = '',
  onApiKeyChange,
}: StreetViewThumbnailProps) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Hydrate key from localStorage
  useEffect(() => {
    const stored = getStoredApiKey()
    if (stored) {
      setApiKey(stored)
      setLoadState('loading')
    } else {
      setLoadState('no-key')
    }
  }, [])

  // When key changes, reset load state
  useEffect(() => {
    if (apiKey) {
      setLoadState('loading')
    }
  }, [apiKey, lat, lng])

  const handleSaveKey = () => {
    const trimmed = keyDraft.trim()
    if (!trimmed) return
    storeApiKey(trimmed)
    setApiKey(trimmed)
    setShowKeyInput(false)
    setKeyDraft('')
    onApiKeyChange?.(trimmed)
  }

  const handleClearKey = () => {
    clearApiKey()
    setApiKey(null)
    setLoadState('no-key')
    onApiKeyChange?.(null)
  }

  const imageUrl = apiKey
    ? getStreetViewUrl(lat, lng, apiKey, width, height)
    : null

  const deepLink = getStreetViewDeepLink(lat, lng)

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      data-testid="streetview-thumbnail"
      style={{ aspectRatio: `${width}/${height}` }}
    >
      {/* --- API Key not set --- */}
      {loadState === 'no-key' && !showKeyInput && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--muted)] text-center px-4">
          <Camera className="w-6 h-6 text-[var(--muted-foreground)] opacity-50" />
          <p className="text-xs text-[var(--muted-foreground)]">
            Street View preview available
          </p>
          <button
            data-testid="streetview-add-key-btn"
            onClick={() => { setShowKeyInput(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Add API Key
          </button>
          <p className="text-[10px] text-[var(--muted-foreground)] opacity-60 max-w-[180px]">
            Stored locally. Never sent to any server.
          </p>
        </div>
      )}

      {/* --- API Key input form --- */}
      {showKeyInput && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--card)] px-4">
          <p className="text-xs font-semibold text-[var(--foreground)]">Street View API Key</p>
          <p className="text-[10px] text-[var(--muted-foreground)] text-center max-w-[200px]">
            Get a key at{' '}
            <a
              href="https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              Google Cloud Console
            </a>
            . Enable the Street View Static API.
          </p>
          <input
            ref={inputRef}
            data-testid="streetview-key-input"
            type="password"
            placeholder="AIza..."
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey(); if (e.key === 'Escape') setShowKeyInput(false) }}
            className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
          />
          <div className="flex gap-2 w-full">
            <button
              data-testid="streetview-save-key-btn"
              onClick={handleSaveKey}
              disabled={!keyDraft.trim()}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Save
            </button>
            <button
              onClick={() => { setShowKeyInput(false); setKeyDraft('') }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* --- Loading skeleton --- */}
      {loadState === 'loading' && imageUrl && (
        <div className="absolute inset-0 bg-[var(--muted)] animate-pulse" />
      )}

      {/* --- Street View image --- */}
      {imageUrl && loadState !== 'no-key' && loadState !== 'no-panorama' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name ? `Street View of ${name}` : 'Street View'}
          data-testid="streetview-image"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loadState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoadState('loaded')}
          onError={(e) => {
            // Google returns 404 for "ZERO_RESULTS" when return_error_code=true
            const img = e.currentTarget as HTMLImageElement
            if (img.naturalWidth === 0) {
              setLoadState('no-panorama')
            }
          }}
        />
      )}

      {/* --- No panorama fallback --- */}
      {loadState === 'no-panorama' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--muted)] text-center px-4">
          <Eye className="w-5 h-5 text-[var(--muted-foreground)] opacity-40" />
          <p className="text-xs text-[var(--muted-foreground)] opacity-60">
            No Street View available here
          </p>
        </div>
      )}

      {/* --- Overlay: open in maps + clear key --- */}
      {loadState === 'loaded' && (
        <>
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2">
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="streetview-open-btn"
              className="flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Street View
            </a>
            <button
              onClick={handleClearKey}
              data-testid="streetview-clear-key-btn"
              title="Remove API key"
              className="text-white/50 hover:text-white/90 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* "Street View" badge top-left */}
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
            <Camera className="w-3 h-3 text-white/80" />
            <span className="text-[10px] font-medium text-white/80">Street View</span>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Compact hover-preview version — shows a tooltip-like popover with the Street View
 * thumbnail when the parent element is hovered.
 */
interface StreetViewHoverPreviewProps {
  lat: number
  lng: number
  name?: string
  /** Whether the preview should be visible */
  visible: boolean
}

export function StreetViewHoverPreview({ lat, lng, name, visible }: StreetViewHoverPreviewProps) {
  const [apiKey, setApiKey] = useState<string | null>(null)

  useEffect(() => {
    setApiKey(getStoredApiKey())
    // Re-check whenever localStorage changes (another tab saves a key)
    const onStorage = (e: StorageEvent) => {
      if (e.key === STREETVIEW_KEY_STORAGE) {
        setApiKey(getStoredApiKey())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (!visible || !apiKey) return null

  const imageUrl = getStreetViewUrl(lat, lng, apiKey, 280, 160)
  const deepLink = getStreetViewDeepLink(lat, lng)

  return (
    <div
      data-testid="streetview-hover-preview"
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-xl overflow-hidden shadow-2xl border border-[var(--border)] pointer-events-none"
      style={{ width: 280 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={name ? `Street View of ${name}` : 'Street View'}
        className="block w-full"
        style={{ height: 160, objectFit: 'cover' }}
      />
      {name && (
        <div className="px-3 py-1.5 bg-[var(--card)] text-xs font-medium text-[var(--foreground)] truncate">
          {name}
        </div>
      )}
    </div>
  )
}
