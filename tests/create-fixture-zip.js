#!/usr/bin/env node
/**
 * Creates a test fixture ZIP that mimics real Google Takeout structure.
 * Used by Playwright tests to verify ZIP upload flow.
 * Run: node tests/create-fixture-zip.js
 */

const JSZip = require('../node_modules/jszip')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '../public/data')
const OUT_PATH = path.join(__dirname, '../tests/fixtures/takeout-test.zip')

async function main() {
  const zip = new JSZip()

  // Google Takeout structure:
  // Takeout/
  //   Maps (your places)/
  //     Saved Places.json
  //     Labeled places.json
  //     Commute routes.json
  //     Saved/
  //       Default list.csv
  //       Favorite places.csv
  //   My Activity/
  //     Maps/
  //       Reviews.json

  const savedPlaces = fs.readFileSync(path.join(DATA_DIR, 'saved-places.json'), 'utf8')
  const reviews = fs.readFileSync(path.join(DATA_DIR, 'reviews.json'), 'utf8')
  const labeledPlaces = fs.readFileSync(path.join(DATA_DIR, 'labeled-places.json'), 'utf8')
  const commuteRoutes = fs.readFileSync(path.join(DATA_DIR, 'commute-routes.json'), 'utf8')

  // Maps your places files
  zip.file('Takeout/Maps (your places)/Saved Places.json', savedPlaces)
  zip.file('Takeout/Maps (your places)/Labeled places.json', labeledPlaces)
  zip.file('Takeout/Maps (your places)/Commute routes.json', commuteRoutes)

  // Reviews in My Activity
  zip.file('Takeout/My Activity/Maps/Reviews.json', reviews)

  // CSV saved lists
  const csvDir = path.join(DATA_DIR, 'csv')
  const csvFiles = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'))
  for (const csvFile of csvFiles) {
    const content = fs.readFileSync(path.join(csvDir, csvFile), 'utf8')
    zip.file(`Takeout/Maps (your places)/Saved/${csvFile}`, content)
  }

  // Google Photos sidecar JSONs — two fake albums with places near real saved-places coords
  // Nubeluz: [-73.9888515, 40.7455382]  (NYC)
  // South Hall: [-77.0481079, 38.89759]  (DC)
  const photoSidecars = [
    // Album: NYC Trip
    {
      path: 'Takeout/Google Photos/NYC Trip/IMG_001.jpg.json',
      data: {
        title: 'IMG_001.jpg',
        photoTakenTime: { timestamp: '1609459200', formatted: 'Jan 1, 2021, 12:00:00 AM UTC' },
        geoData: { latitude: 40.7455, longitude: -73.9888, altitude: 0 },
        geoDataExif: { latitude: 40.7455, longitude: -73.9888, altitude: 0 },
      },
    },
    {
      path: 'Takeout/Google Photos/NYC Trip/IMG_002.jpg.json',
      data: {
        title: 'IMG_002.jpg',
        photoTakenTime: { timestamp: '1609462800', formatted: 'Jan 1, 2021, 1:00:00 AM UTC' },
        geoData: { latitude: 40.7455, longitude: -73.9889, altitude: 0 },
        geoDataExif: { latitude: 40.7455, longitude: -73.9889, altitude: 0 },
      },
    },
    // Album: DC Visits
    {
      path: 'Takeout/Google Photos/DC Visits/IMG_003.jpg.json',
      data: {
        title: 'IMG_003.jpg',
        photoTakenTime: { timestamp: '1612137600', formatted: 'Feb 1, 2021, 12:00:00 AM UTC' },
        geoData: { latitude: 38.8976, longitude: -77.0481, altitude: 0 },
        geoDataExif: { latitude: 38.8976, longitude: -77.0481, altitude: 0 },
      },
    },
    // Photo with no GPS (should be skipped in matching)
    {
      path: 'Takeout/Google Photos/NYC Trip/IMG_004.jpg.json',
      data: {
        title: 'IMG_004.jpg',
        photoTakenTime: { timestamp: '1609545600', formatted: 'Jan 2, 2021, 12:00:00 AM UTC' },
        geoData: { latitude: 0, longitude: 0, altitude: 0 },
        geoDataExif: { latitude: 0, longitude: 0, altitude: 0 },
      },
    },
  ]

  for (const { path: filePath, data: sidecarData } of photoSidecars) {
    zip.file(filePath, JSON.stringify(sidecarData))
  }

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, buf)
  console.log(`✅ Created fixture ZIP: ${OUT_PATH} (${(buf.length / 1024).toFixed(1)} KB)`)
  console.log(`   Includes ${photoSidecars.length} Google Photos sidecar files in 2 albums`)
}

main().catch(e => { console.error(e); process.exit(1) })
