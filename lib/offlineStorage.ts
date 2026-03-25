/**
 * Offline storage using IndexedDB
 *
 * Caches ParsedData so users can reload the app without re-uploading their ZIP.
 */

import type { ParsedData } from './types'

const DB_NAME = 'gmsa-offline'
const DB_VERSION = 1
const STORE_NAME = 'data'
const DATA_KEY = 'parsed-data'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Save parsed data to IndexedDB for offline access.
 */
export async function saveOfflineData(data: ParsedData): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ data, savedAt: new Date().toISOString() }, DATA_KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB unavailable — silently skip
  }
}

/**
 * Load cached data from IndexedDB.
 * Returns null if no cached data exists.
 */
export async function loadOfflineData(): Promise<ParsedData | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(DATA_KEY)
    const result = await new Promise<{ data: ParsedData; savedAt: string } | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return result?.data ?? null
  } catch {
    return null
  }
}

/**
 * Clear cached offline data.
 */
export async function clearOfflineData(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(DATA_KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // silently skip
  }
}
