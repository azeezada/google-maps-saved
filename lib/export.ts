// Export utilities for filtered places

import type { Place } from './types'

/**
 * Converts an array of places to a CSV string.
 * All fields are included; text fields are quoted and escaped.
 */
export function placesToCsv(places: Place[]): string {
  const headers = [
    'name',
    'address',
    'city',
    'country',
    'list',
    'source',
    'date',
    'rating',
    'note',
    'review',
    'latitude',
    'longitude',
    'url',
    'tags',
  ]

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = places.map(p => [
    escape(p.name),
    escape(p.address),
    escape(p.city),
    escape(p.country),
    escape(p.list),
    escape(p.source),
    escape(p.date ?? ''),
    escape(p.rating ?? ''),
    escape(p.note ?? ''),
    escape(p.reviewText ?? ''),
    escape(p.coordinates.lat !== 0 ? p.coordinates.lat : ''),
    escape(p.coordinates.lng !== 0 ? p.coordinates.lng : ''),
    escape(p.url ?? ''),
    escape(p.tags.join('; ')),
  ])

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

/**
 * Triggers a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export places as CSV file.
 */
export function exportCsv(places: Place[], filename = 'places-export.csv'): void {
  const csv = placesToCsv(places)
  downloadFile(csv, filename, 'text/csv;charset=utf-8;')
}

/**
 * Export places as JSON file (array of place objects).
 */
export function exportJson(places: Place[], filename = 'places-export.json'): void {
  const json = JSON.stringify(places, null, 2)
  downloadFile(json, filename, 'application/json')
}

/**
 * Generate a timestamped filename prefix.
 */
export function exportFilename(base: string, ext: string): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10) // YYYY-MM-DD
  return `${base}-${date}.${ext}`
}
