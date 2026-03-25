'use client'

import { useState, useCallback, useRef } from 'react'
import { Plus, Loader2, X, AlertCircle, CheckCircle2, Files } from 'lucide-react'
import type { ParsedData, PhotoMeta } from '@/lib/types'
import { parseAllData } from '@/lib/parser'
import { parsePhotoSidecar } from '@/lib/photos'

export interface LoadedFile {
  name: string
  data: ParsedData
  placeCount: number
}

interface MultiFileManagerProps {
  /** Files already loaded (the primary file is files[0]) */
  files: LoadedFile[]
  /** Called when a new file is successfully parsed */
  onFileAdded: (file: LoadedFile) => void
  /** Called when a file is removed by index */
  onFileRemoved: (index: number) => void
}

async function processZipFile(file: File): Promise<ParsedData> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(file)

  let savedPlacesJson: unknown = null
  let reviewsJson: unknown = null
  let labeledPlacesJson: unknown = null
  let commuteRoutesJson: unknown = null
  const csvLists: { name: string; content: string }[] = []
  const photos: PhotoMeta[] = []

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue
    const lowerPath = path.toLowerCase()

    if (lowerPath.includes('saved places.json')) {
      savedPlacesJson = JSON.parse(await zipEntry.async('string'))
    }
    if (lowerPath.includes('reviews.json') && lowerPath.includes('maps')) {
      reviewsJson = JSON.parse(await zipEntry.async('string'))
    }
    if (lowerPath.includes('labeled places.json')) {
      labeledPlacesJson = JSON.parse(await zipEntry.async('string'))
    }
    if (lowerPath.includes('commute routes.json')) {
      commuteRoutesJson = JSON.parse(await zipEntry.async('string'))
    }
    if (lowerPath.includes('saved/') && lowerPath.endsWith('.csv')) {
      const text = await zipEntry.async('string')
      const name = path.split('/').pop() || 'Unknown.csv'
      csvLists.push({ name, content: text })
    }
    if (lowerPath.includes('google photos/') && lowerPath.endsWith('.json')) {
      try {
        const text = await zipEntry.async('string')
        const json = JSON.parse(text)
        const parts = path.split('/')
        const photosIdx = parts.findIndex(p => p.toLowerCase() === 'google photos')
        const album = photosIdx >= 0 && parts.length > photosIdx + 2 ? parts[photosIdx + 1] : undefined
        const meta = parsePhotoSidecar(json, album)
        if (meta) photos.push(meta)
      } catch { /* skip */ }
    }
  }

  const parsed = parseAllData({
    savedPlacesJson,
    reviewsJson,
    labeledPlacesJson,
    commuteRoutesJson,
    csvLists,
  })
  parsed.photos = photos

  if (parsed.places.length === 0) {
    throw new Error('No places found in this ZIP. Make sure it contains Google Takeout Maps data.')
  }

  return parsed
}

export function MultiFileManager({ files, onFileAdded, onFileRemoved }: MultiFileManagerProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      // Reset input so same file can be re-selected
      e.target.value = ''

      const zipFiles = selectedFiles.filter(f => f.name.endsWith('.zip') || f.type === 'application/zip')
      if (zipFiles.length === 0) {
        setStatus('error')
        setErrorMsg('Please select ZIP file(s).')
        return
      }

      setStatus('loading')
      setErrorMsg('')

      try {
        for (const file of zipFiles) {
          const parsed = await processZipFile(file)
          onFileAdded({ name: file.name, data: parsed, placeCount: parsed.places.length })
        }
        setStatus('idle')
        setIsExpanded(true)
      } catch (err) {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Failed to parse ZIP.')
      }
    },
    [onFileAdded],
  )

  const totalPlaces = files.reduce((s, f) => s + f.placeCount, 0)

  return (
    <div className="multi-file-manager" data-testid="multi-file-manager">
      {/* Toggle button */}
      <button
        className={`multi-file-toggle flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          isExpanded
            ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
            : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
        }`}
        onClick={() => setIsExpanded(v => !v)}
        title="Manage loaded files"
        data-testid="multi-file-toggle"
      >
        <Files className="w-3.5 h-3.5" />
        <span>
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
        {files.length > 1 && (
          <span className="bg-[var(--primary)] text-white rounded-full px-1.5 py-px text-[10px] leading-none">
            {totalPlaces}
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div
          className="multi-file-panel absolute top-full right-0 mt-1 w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 p-3 space-y-2"
          data-testid="multi-file-panel"
        >
          <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
            Loaded ZIPs
          </p>

          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg bg-[var(--muted)] px-2.5 py-2 text-xs"
              data-testid={`loaded-file-${i}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span className="flex-1 truncate font-medium" title={f.name}>
                {f.name}
              </span>
              <span className="text-[var(--muted-foreground)] shrink-0">
                {f.placeCount}
              </span>
              {i > 0 && (
                <button
                  onClick={() => onFileRemoved(i)}
                  className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                  title={`Remove ${f.name}`}
                  data-testid={`remove-file-${i}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Error */}
          {status === 'error' && (
            <div className="flex items-start gap-2 rounded-lg bg-[var(--destructive)]/10 px-2.5 py-2 text-xs text-[var(--destructive)]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Add button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === 'loading'}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--primary)] py-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors disabled:opacity-50"
            data-testid="add-zip-btn"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Parsing…
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Add another ZIP
              </>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            data-testid="multi-file-input"
          />

          <p className="text-[10px] text-[var(--muted-foreground)] leading-relaxed pt-1">
            Duplicate places (same name + location) are merged automatically. The primary ZIP cannot be removed.
          </p>
        </div>
      )}
    </div>
  )
}
