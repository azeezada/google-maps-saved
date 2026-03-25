'use client'

/**
 * TripMap — Leaflet map for the Trips view.
 *
 * Two modes:
 *  - "overview" (trips prop, no trip prop): shows a circle marker for each trip centroid
 *  - "detail" (trip prop): shows pins for all places in the trip
 *
 * Must be loaded dynamically (no SSR) because Leaflet accesses window.
 */

import { useEffect, useRef } from 'react'
import type { Trip } from '@/lib/trips'
import type { Place } from '@/lib/types'

// Leaflet is imported lazily inside useEffect to avoid SSR issues
type L = typeof import('leaflet')

interface TripMapOverviewProps {
  trips: Trip[]
  trip?: undefined
  onSelectTrip: (trip: Trip) => void
  onSelectPlace?: never
}
interface TripMapDetailProps {
  trip: Trip
  trips?: undefined
  onSelectTrip?: never
  onSelectPlace: (place: Place) => void
}
type TripMapProps = TripMapOverviewProps | TripMapDetailProps

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Colour palette for trips (cycles if >10)
const PALETTE = [
  '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899',
]

export default function TripMap(props: TripMapProps) {
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

      if (props.trip) {
        // Detail mode: pins for each place in the trip
        const places = props.trip.places.filter(
          p => p.coordinates.lat !== 0 || p.coordinates.lng !== 0,
        )

        const color = PALETTE[0]

        const markers = places.map(place => {
          const marker = L.circleMarker([place.coordinates.lat, place.coordinates.lng], {
            radius: 7,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            fillOpacity: 0.85,
          })
          marker.bindTooltip(place.name, { direction: 'top', offset: [0, -6] })
          marker.on('click', () => props.onSelectPlace(place))
          return marker
        })

        markers.forEach(m => m.addTo(map))

        if (markers.length > 0) {
          const group = L.featureGroup(markers)
          map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 14 })
        } else {
          map.setView([props.trip.centroid.lat, props.trip.centroid.lng], 10)
        }
      } else {
        // Overview mode: circle markers for each trip
        const { trips, onSelectTrip } = props

        const markers = trips.map((trip, i) => {
          const color = PALETTE[i % PALETTE.length]
          const marker = L.circleMarker([trip.centroid.lat, trip.centroid.lng], {
            radius: 10 + Math.min(trip.places.length * 2, 20),
            fillColor: color,
            color: '#fff',
            weight: 2,
            fillOpacity: 0.75,
          })
          marker.bindTooltip(
            `${trip.name} · ${trip.places.length} places`,
            { direction: 'top', offset: [0, -10] },
          )
          marker.on('click', () => onSelectTrip(trip))
          return marker
        })

        markers.forEach(m => m.addTo(map))

        if (markers.length > 0) {
          const group = L.featureGroup(markers)
          map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 12 })
        } else {
          map.setView([20, 0], 2)
        }
      }
    })()

    return () => {
      isMounted = false
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.trip?.id, (props as TripMapOverviewProps).trips])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      data-testid="trip-map"
    />
  )
}
