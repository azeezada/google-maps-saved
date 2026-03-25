/**
 * "How well do you know [city]?" Quiz Engine
 *
 * Generates trivia questions from the user's saved places data.
 * All processing is client-side — no external API calls.
 */

import type { Place } from './types'
import { getCategoryInfo } from './categories'
import type { PlaceCategory } from './categories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: string
  type:
    | 'which_city'        // "Which city is [place] in?"
    | 'which_list'        // "Which list did you save [place] to?"
    | 'which_category'    // "What type of place is [place]?"
    | 'how_many'          // "How many places did you save in [city]?"
    | 'which_country'     // "Which country is [place] in?"
    | 'top_city'          // "Which city has the most saved places?"
    | 'rating_match'      // "What rating did you give [place]?"
  question: string
  answers: string[]        // 4 options
  correctIndex: number
  place?: Place            // the place this question is about (for fun display)
  hint?: string
}

export interface QuizResult {
  correct: boolean
  correctAnswer: string
  explanation?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

function uniqueBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>()
  return arr.filter(x => {
    const k = key(x)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Insert the correct answer at a random position among 3 distractors */
function buildAnswers(correct: string, distractors: string[]): { answers: string[]; correctIndex: number } {
  const options = shuffle([correct, ...distractors.filter(d => d !== correct).slice(0, 3)])
  // Pad to 4 if needed
  while (options.length < 4) options.push('Unknown')
  const correctIndex = options.indexOf(correct)
  return { answers: options.slice(0, 4), correctIndex }
}

// ---------------------------------------------------------------------------
// Question generators
// ---------------------------------------------------------------------------

function genWhichCity(place: Place, allCities: string[]): QuizQuestion | null {
  if (!place.city || place.city === 'Unknown') return null
  const distractors = pickRandom(allCities.filter(c => c !== place.city), 3)
  if (distractors.length < 1) return null
  const { answers, correctIndex } = buildAnswers(place.city, distractors)
  return {
    id: `which_city_${place.id}`,
    type: 'which_city',
    question: `Which city is "${place.name}" located in?`,
    answers,
    correctIndex,
    place,
    hint: `You saved this to your "${place.list}" list.`,
  }
}

function genWhichCountry(place: Place, allCountries: string[]): QuizQuestion | null {
  if (!place.country || place.country === 'Unknown') return null
  const distractors = pickRandom(allCountries.filter(c => c !== place.country), 3)
  if (distractors.length < 1) return null
  const { answers, correctIndex } = buildAnswers(place.country, distractors)
  return {
    id: `which_country_${place.id}`,
    type: 'which_country',
    question: `Which country is "${place.name}" in?`,
    answers,
    correctIndex,
    place,
  }
}

function genWhichList(place: Place, allLists: string[]): QuizQuestion | null {
  if (!place.list) return null
  const distractors = pickRandom(allLists.filter(l => l !== place.list), 3)
  if (distractors.length < 1) return null
  const { answers, correctIndex } = buildAnswers(place.list, distractors)
  return {
    id: `which_list_${place.id}`,
    type: 'which_list',
    question: `Which list did you save "${place.name}" to?`,
    answers,
    correctIndex,
    place,
  }
}

function genWhichCategory(place: Place, allCategories: string[]): QuizQuestion | null {
  if (!place.category || place.category === 'other') return null
  const correct = getCategoryInfo(place.category as PlaceCategory).label
  const distractors = pickRandom(
    allCategories.filter(c => c !== place.category).map(c => getCategoryInfo(c as PlaceCategory).label),
    3,
  )
  if (distractors.length < 1) return null
  const { answers, correctIndex } = buildAnswers(correct, distractors)
  return {
    id: `which_category_${place.id}`,
    type: 'which_category',
    question: `What type of place is "${place.name}"?`,
    answers,
    correctIndex,
    place,
    hint: getCategoryInfo(place.category as PlaceCategory).emoji,
  }
}

function genRatingMatch(place: Place): QuizQuestion | null {
  if (!place.rating) return null
  const correct = `${place.rating} star${place.rating !== 1 ? 's' : ''}`
  const allRatings = ['1 star', '2 stars', '3 stars', '4 stars', '5 stars']
  const distractors = allRatings.filter(r => r !== correct)
  const { answers, correctIndex } = buildAnswers(correct, pickRandom(distractors, 3))
  return {
    id: `rating_match_${place.id}`,
    type: 'rating_match',
    question: `What rating did you give "${place.name}"?`,
    answers,
    correctIndex,
    place,
  }
}

function genHowMany(city: string, places: Place[], allCounts: number[]): QuizQuestion | null {
  const count = places.filter(p => p.city === city).length
  if (count < 2) return null

  const correct = count.toString()
  const distractors = pickRandom(
    allCounts.filter(c => c !== count).map(c => c.toString()),
    3,
  )
  if (distractors.length < 1) return null
  const { answers, correctIndex } = buildAnswers(correct, distractors)
  return {
    id: `how_many_${city}`,
    type: 'how_many',
    question: `How many places have you saved in ${city}?`,
    answers,
    correctIndex,
  }
}

function genTopCity(
  topCity: string,
  allCities: string[],
): QuizQuestion | null {
  const distractors = pickRandom(allCities.filter(c => c !== topCity), 3)
  if (distractors.length < 1) return null
  const { answers, correctIndex } = buildAnswers(topCity, distractors)
  return {
    id: `top_city`,
    type: 'top_city',
    question: `Which city has the most places you've saved?`,
    answers,
    correctIndex,
    hint: 'Think about your most-visited destination.',
  }
}

// ---------------------------------------------------------------------------
// City filter: generate questions *about* a specific city
// ---------------------------------------------------------------------------

/**
 * Generate a set of quiz questions from the user's saved places.
 * @param places     All (filtered) places
 * @param city       If provided, bias toward questions about this city
 * @param targetCount Number of questions to generate (default 10)
 */
export function generateQuiz(
  places: Place[],
  city: string | null,
  targetCount = 10,
): QuizQuestion[] {
  const citySet = new Set(places.map(p => p.city).filter(Boolean))
  const allCities = [...citySet].filter(c => c !== 'Unknown')
  const countrySet = new Set(places.map(p => p.country).filter(Boolean))
  const allCountries = [...countrySet].filter(c => c !== 'Unknown')
  const listSet = new Set(places.map(p => p.list).filter(Boolean))
  const allLists = [...listSet]
  const categorySet = new Set(places.map(p => p.category).filter(Boolean) as string[])
  const allCategories = [...categorySet]

  // City-count lookup for how_many questions
  const cityCountMap = new Map<string, number>()
  for (const p of places) {
    if (p.city && p.city !== 'Unknown') {
      cityCountMap.set(p.city, (cityCountMap.get(p.city) ?? 0) + 1)
    }
  }
  const allCityCounts = [...new Set([...cityCountMap.values()])]

  // Determine candidate places: prefer places from the selected city
  const cityPlaces = city ? places.filter(p => p.city === city) : places
  const candidatePlaces = uniqueBy(
    [...shuffle(cityPlaces), ...shuffle(places)],
    p => p.id,
  )

  const questions: QuizQuestion[] = []

  // Generator pipeline — mix question types
  for (const place of candidatePlaces) {
    if (questions.length >= targetCount * 3) break // gather extra, then trim
    const gens: Array<() => QuizQuestion | null> = [
      () => genWhichCity(place, allCities),
      () => genWhichList(place, allLists),
      () => genWhichCategory(place, allCategories),
      () => genWhichCountry(place, allCountries),
      () => genRatingMatch(place),
    ]
    for (const gen of gens) {
      if (questions.length >= targetCount * 3) break
      // Avoid duplicate ids
      const q = gen()
      if (q && !questions.find(x => x.id === q.id)) {
        questions.push(q)
      }
    }
  }

  // Add aggregate questions
  if (allCities.length >= 4) {
    const sorted = [...cityCountMap.entries()].sort((a, b) => b[1] - a[1])
    const topCity = sorted[0]?.[0]
    if (topCity) {
      const q = genTopCity(topCity, allCities)
      if (q) questions.push(q)
    }
  }

  for (const c of allCities.slice(0, 5)) {
    const q = genHowMany(c, places, allCityCounts)
    if (q && !questions.find(x => x.id === q.id)) questions.push(q)
  }

  // Shuffle and trim
  return shuffle(questions).slice(0, targetCount)
}

// ---------------------------------------------------------------------------
// Cities with enough data for a focused quiz
// ---------------------------------------------------------------------------

export interface QuizzableCity {
  city: string
  placeCount: number
}

export function getQuizzableCities(places: Place[], minPlaces = 3): QuizzableCity[] {
  const map = new Map<string, number>()
  for (const p of places) {
    if (!p.city || p.city === 'Unknown') continue
    map.set(p.city, (map.get(p.city) ?? 0) + 1)
  }
  return [...map.entries()]
    .filter(([, c]) => c >= minPlaces)
    .sort((a, b) => b[1] - a[1])
    .map(([city, placeCount]) => ({ city, placeCount }))
}
