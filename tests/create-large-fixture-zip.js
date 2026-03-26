#!/usr/bin/env node
/**
 * Creates a large test fixture ZIP with 1000+ saved places.
 * Used by Playwright tests to verify large-file handling and progress indicators.
 * Run: node tests/create-large-fixture-zip.js
 */

const JSZip = require('../node_modules/jszip')
const fs = require('fs')
const path = require('path')

const OUT_PATH = path.join(__dirname, '../tests/fixtures/takeout-large.zip')

/** Generate a random float between min and max */
function rand(min, max) {
  return min + Math.random() * (max - min)
}

const CITIES = [
  { city: 'New York', country: 'United States', code: 'US', lat: 40.71, lng: -74.01 },
  { city: 'London', country: 'United Kingdom', code: 'GB', lat: 51.51, lng: -0.12 },
  { city: 'Paris', country: 'France', code: 'FR', lat: 48.85, lng: 2.35 },
  { city: 'Tokyo', country: 'Japan', code: 'JP', lat: 35.68, lng: 139.69 },
  { city: 'Sydney', country: 'Australia', code: 'AU', lat: -33.87, lng: 151.21 },
  { city: 'Berlin', country: 'Germany', code: 'DE', lat: 52.52, lng: 13.40 },
  { city: 'Toronto', country: 'Canada', code: 'CA', lat: 43.65, lng: -79.38 },
  { city: 'Mexico City', country: 'Mexico', code: 'MX', lat: 19.43, lng: -99.13 },
  { city: 'Rome', country: 'Italy', code: 'IT', lat: 41.90, lng: 12.50 },
  { city: 'Barcelona', country: 'Spain', code: 'ES', lat: 41.39, lng: 2.16 },
]

const PLACE_TYPES = [
  'Restaurant', 'Café', 'Museum', 'Hotel', 'Park', 'Bar', 'Shop', 'Gallery',
  'Theatre', 'Cinema', 'Library', 'Market', 'Beach', 'Church', 'Bakery',
  'Bookstore', 'Gym', 'Spa', 'Airport', 'Station',
]

const LISTS = ['Saved Places', 'Want to go', 'Favorite places', 'Food spots', 'Culture']

function generateSavedPlaces(count) {
  const features = []
  for (let i = 0; i < count; i++) {
    const cityDef = CITIES[i % CITIES.length]
    const placeType = PLACE_TYPES[i % PLACE_TYPES.length]
    const list = LISTS[Math.floor(i / 100) % LISTS.length]

    // Small random offset within the city
    const lat = cityDef.lat + rand(-0.05, 0.05)
    const lng = cityDef.lng + rand(-0.05, 0.05)

    // Generate a date spread over the last 5 years
    const year = 2020 + Math.floor(i / 200)
    const month = String((i % 12) + 1).padStart(2, '0')
    const day = String((i % 28) + 1).padStart(2, '0')
    const date = `${year}-${month}-${day}T${String(i % 24).padStart(2, '0')}:00:00Z`

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        date,
        google_maps_url: `https://maps.google.com/?cid=${1000000 + i}`,
        location: {
          name: `${placeType} ${i + 1}`,
          address: `${i + 1} Main St, ${cityDef.city}, ${cityDef.code}`,
          country_code: cityDef.code,
        },
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function generateReviews(count) {
  const features = []
  for (let i = 0; i < count; i++) {
    const cityDef = CITIES[i % CITIES.length]
    const lat = cityDef.lat + rand(-0.05, 0.05)
    const lng = cityDef.lng + rand(-0.05, 0.05)
    const year = 2019 + Math.floor(i / 50)
    const month = String((i % 12) + 1).padStart(2, '0')
    const date = `${year}-${month}-15T12:00:00Z`
    const ratings = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE']

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        date,
        google_maps_url: `https://maps.google.com/?cid=${2000000 + i}`,
        five_star_rating_published: ratings[i % 5],
        review_text: `Great place ${i + 1}! Would visit again.`,
        location: {
          name: `Review Place ${i + 1}`,
          address: `${i + 100} Review Ave, ${cityDef.city}, ${cityDef.code}`,
          country_code: cityDef.code,
        },
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function generateCSV(listName, count) {
  const lines = ['Title,Note,URL,Tags,Comment']
  for (let i = 0; i < count; i++) {
    const name = `${listName} Place ${i + 1}`
    const url = `https://maps.google.com/?cid=${3000000 + i}`
    lines.push(`"${name}","Note ${i}","${url}","tag1;tag2","Comment ${i}"`)
  }
  return lines.join('\n')
}

async function main() {
  const TOTAL_SAVED = 800
  const TOTAL_REVIEWS = 150
  const CSV_PER_LIST = 50

  console.log(`Generating large fixture: ${TOTAL_SAVED} saved places, ${TOTAL_REVIEWS} reviews, ${CSV_PER_LIST * 2} CSV entries...`)

  const zip = new JSZip()

  const savedPlaces = generateSavedPlaces(TOTAL_SAVED)
  zip.file('Takeout/Maps (your places)/Saved Places.json', JSON.stringify(savedPlaces))

  const reviews = generateReviews(TOTAL_REVIEWS)
  zip.file('Takeout/My Activity/Maps/Reviews.json', JSON.stringify(reviews))

  // Two CSV lists
  zip.file('Takeout/Maps (your places)/Saved/Want to go.csv', generateCSV('Want to go', CSV_PER_LIST))
  zip.file('Takeout/Maps (your places)/Saved/Favorites.csv', generateCSV('Favorites', CSV_PER_LIST))

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, buf)
  const kb = (buf.length / 1024).toFixed(1)
  console.log(`Created large fixture: ${OUT_PATH} (${kb} KB)`)
  console.log(`  Saved places: ${TOTAL_SAVED}`)
  console.log(`  Reviews: ${TOTAL_REVIEWS}`)
  console.log(`  CSV entries: ${CSV_PER_LIST * 2}`)
  console.log(`  Total places: ${TOTAL_SAVED + TOTAL_REVIEWS + CSV_PER_LIST * 2}`)
}

main().catch(e => { console.error(e); process.exit(1) })
