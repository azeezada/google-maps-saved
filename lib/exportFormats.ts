/**
 * GPX and KML export utilities
 *
 * GPX: GPS Exchange Format — used by hiking/outdoor apps (Garmin, AllTrails, etc.)
 * KML: Keyhole Markup Language — used by Google Earth
 */

import type { Place } from './types'
import { downloadFile } from './export'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Convert places to GPX format.
 */
export function placesToGpx(places: Place[]): string {
  const waypoints = places
    .filter(p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0)
    .map(p => {
      const time = p.date ? `    <time>${new Date(p.date).toISOString()}</time>\n` : ''
      const desc = [p.address, p.list, p.note].filter(Boolean).join(' | ')
      return `  <wpt lat="${p.coordinates.lat}" lon="${p.coordinates.lng}">
    <name>${escapeXml(p.name)}</name>
    <desc>${escapeXml(desc)}</desc>
${time}    <type>${escapeXml(p.category || p.list)}</type>
  </wpt>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Google Maps Saved Places Analyzer"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Saved Places Export</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypoints}
</gpx>`
}

/**
 * Convert places to KML format for Google Earth.
 */
export function placesToKml(places: Place[]): string {
  const placemarks = places
    .filter(p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0)
    .map(p => {
      const desc = [p.address, p.list, p.note, p.reviewText]
        .filter(Boolean)
        .join('<br/>')
      const dateStr = p.date ? `      <TimeStamp><when>${new Date(p.date).toISOString()}</when></TimeStamp>\n` : ''
      return `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>${escapeXml(desc)}</description>
${dateStr}      <Point>
        <coordinates>${p.coordinates.lng},${p.coordinates.lat},0</coordinates>
      </Point>
    </Placemark>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Saved Places Export</name>
    <description>Exported from Google Maps Saved Places Analyzer</description>
${placemarks}
  </Document>
</kml>`
}

export function exportGpx(places: Place[], filename = 'places-export.gpx'): void {
  downloadFile(placesToGpx(places), filename, 'application/gpx+xml')
}

export function exportKml(places: Place[], filename = 'places-export.kml'): void {
  downloadFile(placesToKml(places), filename, 'application/vnd.google-earth.kml+xml')
}
