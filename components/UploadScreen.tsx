'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, Loader2, AlertCircle, Map, BarChart3, Search, Route, Tag, Download, Lock, Zap, Globe } from 'lucide-react'
import type { ParsedData, PhotoMeta } from '@/lib/types'
import { parseAllData } from '@/lib/parser'
import { parsePhotoSidecar } from '@/lib/photos'

interface UploadScreenProps {
  onDataLoaded: (data: ParsedData, fileName?: string) => void
}

const FEATURES = [
  {
    icon: Map,
    title: 'Interactive Map',
    description: 'Explore all your saved places on a live Leaflet map with clustering, heatmap, and filter overlays.',
    color: '#3b82f6',
  },
  {
    icon: BarChart3,
    title: 'Deep Analytics',
    description: 'Save frequency charts, neighborhood rankings, category breakdowns, and year-over-year heatmaps.',
    color: '#f59e0b',
  },
  {
    icon: Search,
    title: 'Smart Filtering',
    description: 'Filter by list, city, country, category, rating, and date range — all in real time.',
    color: '#8b5cf6',
  },
  {
    icon: Route,
    title: 'Trip Detection',
    description: 'Automatically groups places saved in the same time window and region into named trips.',
    color: '#10b981',
  },
  {
    icon: Tag,
    title: 'Category Inference',
    description: '19 auto-detected categories: restaurant, café, museum, hotel, park, and more — no AI needed.',
    color: '#ec4899',
  },
  {
    icon: Download,
    title: 'Export Anywhere',
    description: 'Download your filtered data as CSV or JSON anytime. Your data, your format.',
    color: '#06b6d4',
  },
]

function AnimatedCounter({ end, duration = 1500 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * end))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [end, duration])

  return <>{count}</>
}

export function UploadScreen({ onDataLoaded }: UploadScreenProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [parseProgress, setParseProgress] = useState(0) // 0-100
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadSectionRef = useRef<HTMLDivElement>(null)
  const [countersVisible, setCountersVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  // Trigger counter animation when stats section scrolls into view
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCountersVisible(true) },
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const processZip = useCallback(async (file: File, fileName?: string) => {
    setStatus('loading')
    setParseProgress(0)
    setStatusMsg('Loading ZIP library...')

    try {
      const JSZip = (await import('jszip')).default
      setParseProgress(10)
      setStatusMsg('Reading ZIP file...')
      const zip = await JSZip.loadAsync(file)
      setParseProgress(20)
      setStatusMsg('Parsing data files...')

      let savedPlacesJson: unknown = null
      let reviewsJson: unknown = null
      let labeledPlacesJson: unknown = null
      let commuteRoutesJson: unknown = null
      const csvLists: { name: string; content: string }[] = []
      const photos: PhotoMeta[] = []

      const entries = Object.entries(zip.files).filter(([, e]) => !e.dir)
      const totalEntries = entries.length

      for (let i = 0; i < entries.length; i++) {
        const [path, zipEntry] = entries[i]
        const lowerPath = path.toLowerCase()

        // Update progress: 20-80% range for file parsing
        if (i % 10 === 0 || i === entries.length - 1) {
          setParseProgress(20 + Math.round((i / totalEntries) * 60))
        }

        if (lowerPath.includes('saved places.json')) {
          const text = await zipEntry.async('string')
          savedPlacesJson = JSON.parse(text)
          setStatusMsg('Found Saved Places...')
        }
        if (lowerPath.includes('reviews.json') && lowerPath.includes('maps')) {
          const text = await zipEntry.async('string')
          reviewsJson = JSON.parse(text)
          setStatusMsg('Found Reviews...')
        }
        if (lowerPath.includes('labeled places.json')) {
          const text = await zipEntry.async('string')
          labeledPlacesJson = JSON.parse(text)
          setStatusMsg('Found Labeled Places...')
        }
        if (lowerPath.includes('commute routes.json')) {
          const text = await zipEntry.async('string')
          commuteRoutesJson = JSON.parse(text)
          setStatusMsg('Found Commute Routes...')
        }
        if (lowerPath.includes('saved/') && lowerPath.endsWith('.csv')) {
          const text = await zipEntry.async('string')
          const name = path.split('/').pop() || 'Unknown.csv'
          csvLists.push({ name, content: text })
        }
        // Parse Google Photos sidecar JSON files
        if (lowerPath.includes('google photos/') && lowerPath.endsWith('.json')) {
          try {
            const text = await zipEntry.async('string')
            const json = JSON.parse(text)
            // Extract album name from path: Google Photos/<AlbumName>/file.json
            const parts = path.split('/')
            const photosIdx = parts.findIndex(p => p.toLowerCase() === 'google photos')
            const album = photosIdx >= 0 && parts.length > photosIdx + 2 ? parts[photosIdx + 1] : undefined
            const meta = parsePhotoSidecar(json, album)
            if (meta) photos.push(meta)
          } catch {
            // skip invalid JSON
          }
        }
      }

      setParseProgress(85)
      setStatusMsg('Computing analytics...')
      if (photos.length > 0) setStatusMsg(`Found ${photos.length} photos...`)
      const parsed = parseAllData({
        savedPlacesJson,
        reviewsJson,
        labeledPlacesJson,
        commuteRoutesJson,
        csvLists,
      })
      parsed.photos = photos
      setParseProgress(95)

      if (parsed.places.length === 0) {
        setStatus('error')
        setStatusMsg('No places found in the ZIP file. Make sure it contains Google Takeout data with Maps/Saved data.')
        return
      }

      setParseProgress(100)
      setStatus('idle')
      onDataLoaded(parsed, fileName ?? file.name)
    } catch (err: unknown) {
      setStatus('error')
      setStatusMsg(err instanceof Error ? err.message : 'Failed to parse ZIP file')
    }
  }, [onDataLoaded])

  const processMultipleZips = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    if (files.length === 1) {
      processZip(files[0], files[0].name)
      return
    }

    setStatus('loading')
    setStatusMsg(`Processing ${files.length} ZIP files...`)

    try {
      const JSZipMod = (await import('jszip')).default
      const { mergeParsedData } = await import('@/lib/merge')
      const allParsed: ParsedData[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setStatusMsg(`Parsing file ${i + 1}/${files.length}: ${file.name}...`)
        const zip = await JSZipMod.loadAsync(file)

        let savedPlacesJson: unknown = null
        let reviewsJson: unknown = null
        let labeledPlacesJson: unknown = null
        let commuteRoutesJson: unknown = null
        const csvLists: { name: string; content: string }[] = []
        const photos: PhotoMeta[] = []

        for (const [path, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue
          const lowerPath = path.toLowerCase()
          if (lowerPath.includes('saved places.json')) savedPlacesJson = JSON.parse(await zipEntry.async('string'))
          if (lowerPath.includes('reviews.json') && lowerPath.includes('maps')) reviewsJson = JSON.parse(await zipEntry.async('string'))
          if (lowerPath.includes('labeled places.json')) labeledPlacesJson = JSON.parse(await zipEntry.async('string'))
          if (lowerPath.includes('commute routes.json')) commuteRoutesJson = JSON.parse(await zipEntry.async('string'))
          if (lowerPath.includes('saved/') && lowerPath.endsWith('.csv')) {
            csvLists.push({ name: path.split('/').pop() || 'Unknown.csv', content: await zipEntry.async('string') })
          }
          if (lowerPath.includes('google photos/') && lowerPath.endsWith('.json')) {
            try {
              const json = JSON.parse(await zipEntry.async('string'))
              const parts = path.split('/')
              const photosIdx = parts.findIndex(p => p.toLowerCase() === 'google photos')
              const album = photosIdx >= 0 && parts.length > photosIdx + 2 ? parts[photosIdx + 1] : undefined
              const meta = parsePhotoSidecar(json, album)
              if (meta) photos.push(meta)
            } catch { /* skip */ }
          }
        }

        const parsed = parseAllData({ savedPlacesJson, reviewsJson, labeledPlacesJson, commuteRoutesJson, csvLists })
        parsed.photos = photos
        allParsed.push(parsed)
      }

      setStatusMsg('Merging and deduplicating...')
      const merged = allParsed.length === 1 ? allParsed[0] : mergeParsedData(allParsed)

      if (merged.places.length === 0) {
        setStatus('error')
        setStatusMsg('No places found in the uploaded files.')
        return
      }

      setStatus('idle')
      onDataLoaded(merged, files.map(f => f.name).join(', '))
    } catch (err: unknown) {
      setStatus('error')
      setStatusMsg(err instanceof Error ? err.message : 'Failed to parse ZIP files')
    }
  }, [processZip, onDataLoaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.zip') || f.type === 'application/zip'
    )
    if (files.length > 0) {
      processMultipleZips(files)
    } else {
      setStatus('error')
      setStatusMsg('Please upload ZIP files from Google Takeout')
    }
  }, [processMultipleZips])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) processMultipleZips(files)
  }, [processMultipleZips])

  const handleLoadDemo = useCallback(async () => {
    setStatus('loading')
    setStatusMsg('Loading demo data...')

    try {
      const [savedPlacesRes, reviewsRes, labeledRes, commuteRes] = await Promise.all([
        fetch('/data/saved-places.json').then(r => r.json()).catch(() => null),
        fetch('/data/reviews.json').then(r => r.json()).catch(() => null),
        fetch('/data/labeled-places.json').then(r => r.json()).catch(() => null),
        fetch('/data/commute-routes.json').then(r => r.json()).catch(() => null),
      ])

      const csvListNames = [
        'Default list', 'Favorite places', 'Want to go',
        'cultura', 'foodie', 'night out',
        'Saved for later', 'Default list(1)', 'Default list(2)',
        'd', 'Reading list',
      ]
      const csvLists: { name: string; content: string }[] = []
      for (const name of csvListNames) {
        try {
          const res = await fetch(`/data/csv/${encodeURIComponent(name)}.csv`)
          if (res.ok) {
            csvLists.push({ name: `${name}.csv`, content: await res.text() })
          }
        } catch {
          // skip
        }
      }

      const parsed = parseAllData({
        savedPlacesJson: savedPlacesRes,
        reviewsJson: reviewsRes,
        labeledPlacesJson: labeledRes,
        commuteRoutesJson: commuteRes,
        csvLists,
      })

      setStatus('idle')
      onDataLoaded(parsed)
    } catch (err: unknown) {
      setStatus('error')
      setStatusMsg('Failed to load demo data: ' + (err instanceof Error ? err.message : ''))
    }
  }, [onDataLoaded])

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="landing-root min-h-screen overflow-y-auto overflow-x-hidden">
      {/* ═══════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════ */}
      <section className="landing-hero relative min-h-screen flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="orb orb-1" aria-hidden="true" />
        <div className="orb orb-2" aria-hidden="true" />
        <div className="orb orb-3" aria-hidden="true" />

        {/* Dot grid overlay */}
        <div className="dot-grid" aria-hidden="true" />

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="landing-badge inline-flex items-center gap-2 mb-6">
            <Lock className="w-3 h-3" />
            <span>Privacy-first · Runs 100% in your browser · Free</span>
          </div>

          {/* Headline */}
          <h1 className="landing-headline text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Your Google Maps life,{' '}
            <span className="gradient-text">visualized</span>
          </h1>

          {/* Sub */}
          <p className="landing-sub text-base sm:text-lg text-[var(--muted-foreground)] mb-10 max-w-xl mx-auto leading-relaxed">
            Upload your Google Takeout ZIP and discover hidden patterns — trips you took, places
            you love, and cities you&apos;ve saved across the globe.
          </p>

          {/* CTAs */}
          <div className="landing-ctas flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <button
              onClick={scrollToUpload}
              className="landing-cta-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
            >
              <Upload className="w-4 h-4" />
              Upload Takeout ZIP
            </button>
            <button
              onClick={handleLoadDemo}
              disabled={status === 'loading'}
              data-testid="load-demo"
              className="landing-cta-secondary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {status === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {status === 'loading' ? statusMsg : 'Try Demo →'}
            </button>
          </div>

          {/* Mini stats */}
          <div ref={statsRef} className="landing-stats flex flex-wrap justify-center gap-6 text-sm text-[var(--muted-foreground)]">
            <span className="stat-chip">
              📍&nbsp;
              <strong className="text-[var(--foreground)]">
                {countersVisible ? <AnimatedCounter end={40} /> : 0}
              </strong>
              &nbsp;saved places in demo
            </span>
            <span className="stat-chip">
              📋&nbsp;
              <strong className="text-[var(--foreground)]">
                {countersVisible ? <AnimatedCounter end={11} /> : 0}
              </strong>
              &nbsp;lists
            </span>
            <span className="stat-chip">
              ⭐&nbsp;
              <strong className="text-[var(--foreground)]">
                {countersVisible ? <AnimatedCounter end={6} /> : 0}
              </strong>
              &nbsp;reviews
            </span>
          </div>
        </div>

        {/* Scroll chevron */}
        <button
          onClick={scrollToUpload}
          className="scroll-chevron absolute bottom-8 left-1/2 -translate-x-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Scroll to upload"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 8 10 14 16 8" />
          </svg>
        </button>
      </section>

      {/* ═══════════════════════════════════════
          FEATURES SECTION
      ═══════════════════════════════════════ */}
      <section className="landing-features px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
            Everything about your saved places
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
            Turn raw Takeout data into actionable insights. No account, no upload to servers.
          </p>
        </div>

        <div className="features-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="feature-card group relative rounded-xl p-5 border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:border-[var(--primary)]/50 transition-all duration-300">
                {/* Glow on hover */}
                <div
                  className="feature-card-glow absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-xl"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${f.color}, transparent 70%)` }}
                />
                <div className="relative z-10">
                  <div
                    className="feature-icon w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `${f.color}20`, color: f.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{f.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Privacy callout */}
        <div className="privacy-callout mt-10 flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Your data never leaves your device</h3>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              All parsing, geocoding, and analysis runs entirely in your browser using JavaScript. Nothing is uploaded to any server — not even for caching. You can even use this app offline once loaded.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          UPLOAD SECTION
      ═══════════════════════════════════════ */}
      <section ref={uploadSectionRef} id="upload" className="upload-section px-6 py-16 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] mb-4">
            <Globe className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2 tracking-tight">Upload your Takeout data</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Drop the ZIP from Google Takeout or try the demo.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`upload-zone relative rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-2 border-dashed border-[var(--primary)] bg-[var(--primary)]/10'
              : status === 'error'
              ? 'border-2 border-dashed border-[var(--destructive)]/50 bg-[var(--destructive)]/5'
              : 'border-2 border-dashed border-[var(--border)] hover:border-[var(--muted-foreground)] bg-[var(--card)]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {status === 'loading' ? (
            <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
              <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />
              <p className="text-sm text-[var(--muted-foreground)]">{statusMsg}</p>
              {parseProgress > 0 && (
                <div className="w-full" data-testid="parse-progress">
                  <div className="w-full h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all duration-300 ease-out"
                      style={{ width: `${parseProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1 text-center">{parseProgress}%</p>
                </div>
              )}
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 text-[var(--destructive)]" />
              <p className="text-sm text-[var(--destructive)]">{statusMsg}</p>
              <p className="text-xs text-[var(--muted-foreground)]">Click to try again</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-[var(--muted)] flex items-center justify-center">
                <Upload className="w-6 h-6 text-[var(--muted-foreground)]" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Drop your Takeout ZIP(s) here</p>
                <p className="text-xs text-[var(--muted-foreground)]">or click to browse · supports multiple files</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center">
          <button
            onClick={handleLoadDemo}
            disabled={status === 'loading'}
            data-testid="load-demo"
            className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
          >
            Load demo data instead →
          </button>
        </div>

        {/* How-to steps */}
        <div className="mt-8 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            How to export your data
          </h2>
          <ol className="text-xs text-[var(--muted-foreground)] space-y-2">
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center text-[10px] font-bold">1</span>
              <span>Go to <a href="https://takeout.google.com" target="_blank" rel="noopener" className="text-[var(--primary)] hover:underline">takeout.google.com</a></span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center text-[10px] font-bold">2</span>
              <span>Click &quot;Deselect all&quot;, then select &quot;Maps (your places)&quot; and &quot;Saved&quot;</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Export and download the ZIP file</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center text-[10px] font-bold">4</span>
              <span>Upload it here — everything stays in your browser 🔒</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-[var(--muted-foreground)] py-8 border-t border-[var(--border)]">
        Open source · Privacy-first · No sign-up required
      </footer>
    </div>
  )
}
