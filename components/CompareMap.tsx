'use client'

/**
 * CompareMap — Leaflet map showing two lists of places with different colours.
 * Must be loaded dynamically (no SSR) because Leaflet accesses window.
 */

import { useEffect, useRef } from 'react'
import type { Place } from '@/lib/types'

type L = typeof import('leaflet')

interface CompareMapProps {
  placesA: Place[]
  placesB: Place[]
  colorA: string
  colorB: string
  labelA: string
  labelB: string
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

export default function CompareMap({ placesA, placesB, colorA, colorB, labelA, labelB }: CompareMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<ReturnType<L['map']> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let isMounted = true

    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (!isMounted || !containerRef.current) return
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      })
      mapRef.current = map

      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map)

      const allMarkers: ReturnType<typeof L.circleMarker>[] = []

      function addPlaces(places: Place[], color: string, label: string) {
        for (const place of places) {
          if (place.coordinates.lat === 0 && place.coordinates.lng === 0) continue
          const marker = L.circleMarker([place.coordinates.lat, place.coordinates.lng], {
            radius: 6,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            fillOpacity: 0.85,
          })
          marker.bindTooltip(`[${label}] ${place.name}`, { direction: 'top', offset: [0, -6] })
          marker.addTo(map)
          allMarkers.push(marker)
        }
      }

      addPlaces(placesA, colorA, labelA)
      addPlaces(placesB, colorB, labelB)

      if (allMarkers.length > 0) {
        const group = L.featureGroup(allMarkers)
        map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 14 })
      } else {
        map.setView([20, 0], 2)
      }
    })()

    return () => {
      isMounted = false
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [placesA, placesB, colorA, colorB, labelA, labelB])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      data-testid="compare-map"
    />
  )
}
