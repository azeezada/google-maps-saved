/**
 * "You might like" suggestions engine
 *
 * Analyses patterns in the user's saved places (categories, cities,
 * countries, lists, ratings) and generates contextual recommendations:
 * what kinds of places to look for next, which cities to explore, etc.
 *
 * 100% client-side — no external API calls.
 */

import type { Place } from './types'
import { CATEGORY_INFO, inferCategory } from './categories'
import type { PlaceCategory } from './categories'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SuggestionKind =
  | 'explore_category'   // "You love cafés — try exploring more coffee shops"
  | 'try_new_category'   // "You haven't saved any parks — maybe branch out?"
  | 'revisit_city'       // "You saved a lot in Tokyo — worth another visit?"
  | 'explore_country'    // "You've been to 3 Japanese cities — ever tried Osaka?"
  | 'rate_more'          // "You rate rarely — try rating the places you've reviewed"
  | 'diversify_lists'    // "Most saves are in one list — try creating more lists"
  | 'save_more'          // "You save infrequently — try saving a few new spots"
  | 'top_list_deep_dive' // "You have 15 items in 'Want to Go' — time to visit?"

export interface Suggestion {
  id: string
  kind: SuggestionKind
  emoji: string
  title: string
  body: string
  /** Optional label for the main call-to-action (e.g. a category or city name) */
  tag?: string
  tagColor?: string
  /** 0–100 relevance score (higher = show first) */
  score: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function top<T extends string>(
  record: Record<T, number>,
  n: number,
): Array<[T, number]> {
  return (Object.entries(record) as [T, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
}

function percentage(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

export interface SuggestionsResult {
  suggestions: Suggestion[]
  /** Summary string about the user's taste profile */
  tasteProfile: string
}

export function generateSuggestions(places: Place[]): SuggestionsResult {
  if (places.length === 0) {
    return { suggestions: [], tasteProfile: '' }
  }

  const suggestions: Suggestion[] = []

  // ------------------------------------------------------------------
  // 1. Build frequency maps
  // ------------------------------------------------------------------

  const catCounts: Record<PlaceCategory, number> = {} as Record<PlaceCategory, number>
  const cityCounts: Record<string, number> = {}
  const countryCounts: Record<string, number> = {}
  const listCounts: Record<string, number> = {}
  let ratedCount = 0
  let datedCount = 0

  for (const p of places) {
    const cat = (p.category ?? inferCategory(p.name, p.address, p.list)) as PlaceCategory
    catCounts[cat] = (catCounts[cat] ?? 0) + 1

    if (p.city && p.city !== 'Unknown') {
      cityCounts[p.city] = (cityCounts[p.city] ?? 0) + 1
    }
    if (p.country && p.country !== 'Unknown') {
      countryCounts[p.country] = (countryCounts[p.country] ?? 0) + 1
    }
    listCounts[p.list] = (listCounts[p.list] ?? 0) + 1
    if (p.rating) ratedCount++
    if (p.date) datedCount++
  }

  const total = places.length
  const topCats = top(catCounts as Record<PlaceCategory, number>, 5)
  const topCities = top(cityCounts, 5)
  const topCountries = top(countryCounts, 3)
  const topLists = top(listCounts, 3)
  const allCategories: PlaceCategory[] = [
    'restaurant', 'cafe', 'bar', 'bakery', 'museum', 'hotel',
    'shop', 'park', 'gym', 'entertainment', 'beach', 'attraction',
  ]

  // ------------------------------------------------------------------
  // 2. Explore a favourite category
  // ------------------------------------------------------------------

  if (topCats.length > 0) {
    const [favCat, favCount] = topCats[0]
    if (favCat !== 'other') {
      const info = CATEGORY_INFO[favCat]
      const pct = percentage(favCount, total)
      suggestions.push({
        id: 'explore_fav_category',
        kind: 'explore_category',
        emoji: info.emoji,
        title: `More ${info.label}s`,
        body: `${pct}% of your places are ${info.label.toLowerCase()}s. There are probably hidden gems you haven't saved yet — dive deeper into this type!`,
        tag: info.label,
        tagColor: info.color,
        score: 80 + Math.min(pct, 20),
      })
    }
  }

  // ------------------------------------------------------------------
  // 3. Try a category you've never saved
  // ------------------------------------------------------------------

  const savedCats = new Set(Object.keys(catCounts) as PlaceCategory[])
  const unsaved = allCategories.filter(c => !savedCats.has(c) || (catCounts[c] ?? 0) === 0)

  if (unsaved.length > 0) {
    // Pick the most interesting unsaved category
    const PRIORITY_ORDER: PlaceCategory[] = [
      'museum', 'park', 'beach', 'entertainment', 'bakery', 'gym',
      'attraction', 'bar', 'cafe', 'restaurant', 'shop', 'hotel',
    ]
    const candidate = PRIORITY_ORDER.find(c => unsaved.includes(c)) ?? unsaved[0]
    const info = CATEGORY_INFO[candidate]
    suggestions.push({
      id: 'try_new_category',
      kind: 'try_new_category',
      emoji: info.emoji,
      title: `Discover ${info.label}s`,
      body: `You haven't saved any ${info.label.toLowerCase()}s yet. Branching out could lead to some great new discoveries!`,
      tag: info.label,
      tagColor: info.color,
      score: 60,
    })
  }

  // ------------------------------------------------------------------
  // 4. Revisit a favourite city
  // ------------------------------------------------------------------

  if (topCities.length > 0) {
    const [favCity, favCityCount] = topCities[0]
    suggestions.push({
      id: 'revisit_top_city',
      kind: 'revisit_city',
      emoji: '🏙️',
      title: `Return to ${favCity}`,
      body: `You've saved ${favCityCount} place${favCityCount > 1 ? 's' : ''} in ${favCity} — your most-saved city. Chances are there are more spots worth adding to your list!`,
      tag: favCity,
      score: 70 + Math.min(favCityCount, 15),
    })
  }

  // ------------------------------------------------------------------
  // 5. Explore a second city in your top country
  // ------------------------------------------------------------------

  if (topCountries.length > 0) {
    const [favCountry, favCountryCount] = topCountries[0]
    const citiesInCountry = places
      .filter(p => p.country === favCountry && p.city && p.city !== 'Unknown')
      .map(p => p.city)
    const uniqueCities = new Set(citiesInCountry)

    if (uniqueCities.size === 1) {
      const [onlyCity] = uniqueCities
      suggestions.push({
        id: 'explore_country_other_cities',
        kind: 'explore_country',
        emoji: '🗺️',
        title: `Explore more of ${favCountry}`,
        body: `All ${favCountryCount} of your ${favCountry} saves are in ${onlyCity}. There's likely a lot more to discover across the rest of the country!`,
        tag: favCountry,
        score: 65,
      })
    } else if (uniqueCities.size >= 2 && topCities.length >= 2) {
      // They already explore multiple cities — nudge for a new country
      const secondCountry = topCountries[1]?.[0]
      if (secondCountry) {
        suggestions.push({
          id: 'explore_second_country',
          kind: 'explore_country',
          emoji: '✈️',
          title: `Dive deeper into ${secondCountry}`,
          body: `You've explored places in ${secondCountry} — but your saves there are sparse. There could be a lot more worth discovering!`,
          tag: secondCountry,
          score: 55,
        })
      }
    }
  }

  // ------------------------------------------------------------------
  // 6. Rate more places
  // ------------------------------------------------------------------

  const ratedPct = percentage(ratedCount, total)
  if (ratedPct < 20 && total > 5) {
    suggestions.push({
      id: 'rate_more',
      kind: 'rate_more',
      emoji: '⭐',
      title: 'Rate your favourites',
      body: `Only ${ratedPct}% of your places have a star rating. Adding ratings helps you remember which spots were actually worth it.`,
      score: 50,
    })
  }

  // ------------------------------------------------------------------
  // 7. Diversify your lists
  // ------------------------------------------------------------------

  if (topLists.length > 0) {
    const [bigList, bigListCount] = topLists[0]
    const bigListPct = percentage(bigListCount, total)
    if (bigListPct > 60 && Object.keys(listCounts).length < 4) {
      suggestions.push({
        id: 'diversify_lists',
        kind: 'diversify_lists',
        emoji: '📋',
        title: 'Organise into more lists',
        body: `${bigListPct}% of your places are in "${bigList}". Creating themed lists (like "Date Nights" or "Weekend Hikes") makes it easier to find the right spot.`,
        tag: bigList,
        score: 45,
      })
    }
  }

  // ------------------------------------------------------------------
  // 8. Top "Want to Go" list — suggest actually going
  // ------------------------------------------------------------------

  const wantToGoKey = Object.keys(listCounts).find(
    l => l.toLowerCase().includes('want') || l.toLowerCase().includes('wish'),
  )
  if (wantToGoKey) {
    const cnt = listCounts[wantToGoKey]
    if (cnt >= 5) {
      suggestions.push({
        id: 'top_list_deep_dive',
        kind: 'top_list_deep_dive',
        emoji: '🎯',
        title: `Visit your "${wantToGoKey}" list`,
        body: `You have ${cnt} places in "${wantToGoKey}" — maybe it's time to actually go? Pick the closest one and make a plan!`,
        tag: wantToGoKey,
        score: 75,
      })
    }
  }

  // ------------------------------------------------------------------
  // 9. Second favourite category — "branch out within your comfort zone"
  // ------------------------------------------------------------------

  if (topCats.length >= 2) {
    const [, [secondCat, secondCount]] = topCats
    if (secondCat !== 'other') {
      const info = CATEGORY_INFO[secondCat]
      const pct = percentage(secondCount, total)
      if (pct >= 10) {
        suggestions.push({
          id: 'explore_second_category',
          kind: 'explore_category',
          emoji: info.emoji,
          title: `More ${info.label}s to explore`,
          body: `${info.label}s are your second-favourite type of place (${pct}% of saves). You clearly have good taste here — keep exploring!`,
          tag: info.label,
          tagColor: info.color,
          score: 62,
        })
      }
    }
  }

  // ------------------------------------------------------------------
  // 10. Build taste-profile summary string
  // ------------------------------------------------------------------

  const profileParts: string[] = []
  if (topCats.length > 0 && topCats[0][0] !== 'other') {
    profileParts.push(`a ${CATEGORY_INFO[topCats[0][0]].label.toLowerCase()} lover`)
  }
  if (topCities.length > 0) {
    profileParts.push(`drawn to ${topCities[0][0]}`)
  }
  if (topCountries.length > 0) {
    profileParts.push(`exploring ${topCountries[0][0]}`)
  }

  const tasteProfile =
    profileParts.length > 0
      ? `You appear to be ${profileParts.join(', ')}. Here's what we think you might enjoy next:`
      : 'Based on your saved places, here are some things you might enjoy:'

  // Sort by score descending, deduplicate
  const sorted = suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 6) // max 6 suggestions

  return { suggestions: sorted, tasteProfile }
}
