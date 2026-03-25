/**
 * Category inference for Places
 * Guesses the type of a place (restaurant, bar, museum, etc.)
 * based on name patterns, tags, and list name.
 */

export type PlaceCategory =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'bakery'
  | 'museum'
  | 'hotel'
  | 'shop'
  | 'park'
  | 'airport'
  | 'transit'
  | 'gym'
  | 'hospital'
  | 'school'
  | 'place_of_worship'
  | 'entertainment'
  | 'beach'
  | 'attraction'
  | 'office'
  | 'other'

export interface CategoryInfo {
  category: PlaceCategory
  label: string
  emoji: string
  color: string
}

export const CATEGORY_INFO: Record<PlaceCategory, CategoryInfo> = {
  restaurant:       { category: 'restaurant',      label: 'Restaurant',     emoji: '🍽️', color: '#ef4444' },
  cafe:             { category: 'cafe',             label: 'Café',           emoji: '☕', color: '#92400e' },
  bar:              { category: 'bar',              label: 'Bar',            emoji: '🍺', color: '#f59e0b' },
  bakery:           { category: 'bakery',           label: 'Bakery',         emoji: '🥐', color: '#d97706' },
  museum:           { category: 'museum',           label: 'Museum',         emoji: '🏛️', color: '#8b5cf6' },
  hotel:            { category: 'hotel',            label: 'Hotel',          emoji: '🏨', color: '#6366f1' },
  shop:             { category: 'shop',             label: 'Shop',           emoji: '🛍️', color: '#06b6d4' },
  park:             { category: 'park',             label: 'Park',           emoji: '🌳', color: '#10b981' },
  airport:          { category: 'airport',          label: 'Airport',        emoji: '✈️', color: '#3b82f6' },
  transit:          { category: 'transit',          label: 'Transit',        emoji: '🚉', color: '#0ea5e9' },
  gym:              { category: 'gym',              label: 'Gym',            emoji: '💪', color: '#14b8a6' },
  hospital:         { category: 'hospital',         label: 'Hospital',       emoji: '🏥', color: '#f43f5e' },
  school:           { category: 'school',           label: 'School',         emoji: '🏫', color: '#84cc16' },
  place_of_worship: { category: 'place_of_worship', label: 'Worship',        emoji: '🕌', color: '#a78bfa' },
  entertainment:    { category: 'entertainment',    label: 'Entertainment',  emoji: '🎭', color: '#ec4899' },
  beach:            { category: 'beach',            label: 'Beach',          emoji: '🏖️', color: '#f97316' },
  attraction:       { category: 'attraction',       label: 'Attraction',     emoji: '📸', color: '#e11d48' },
  office:           { category: 'office',           label: 'Office',         emoji: '🏢', color: '#64748b' },
  other:            { category: 'other',            label: 'Other',          emoji: '📍', color: '#94a3b8' },
}

// -----------------------------------------------------------------------
// Pattern matching rules
// Each rule is tested against: lowercased place name, address, list name
// Rules are ordered from most specific to most general.
// -----------------------------------------------------------------------

type Rule = { patterns: RegExp[]; category: PlaceCategory }

const RULES: Rule[] = [
  // Airport
  {
    patterns: [
      /\b(airport|aéroport|aeropuerto|aeroport|flughafen)\b/i,
      /\b[A-Z]{3}\s+(international|intl)\s+airport/i,
    ],
    category: 'airport',
  },
  // Transit
  {
    patterns: [
      /\b(train station|metro|subway|bus stop|bus station|transit|gare|bahnhof|estación|railway|rail station|tram)\b/i,
    ],
    category: 'transit',
  },
  // Hospital / Medical
  {
    patterns: [
      /\b(hospital|clinic|medical center|urgent care|emergency room|pharmacy|pharmacie|pharmacist|drugstore|walgreens|cvs|dentist|dental|doctor|physician)\b/i,
    ],
    category: 'hospital',
  },
  // Gym / Fitness
  {
    patterns: [
      /\b(gym|fitness|crossfit|yoga|pilates|anytime fitness|planet fitness|equinox|orange theory|la fitness|24 hour fitness)\b/i,
    ],
    category: 'gym',
  },
  // Museum / Gallery
  {
    patterns: [
      /\b(museum|musée|museu|museo|gallery|galerie|exhibition|exhibit|moma|smithsonian|louvre|tate)\b/i,
    ],
    category: 'museum',
  },
  // Place of Worship
  {
    patterns: [
      /\b(church|mosque|masjid|synagogue|temple|cathedral|chapel|basilica|shrine|monastery|pagoda|mandir|gurdwara|parish)\b/i,
    ],
    category: 'place_of_worship',
  },
  // School / University
  {
    patterns: [
      /\b(university|college|school|academy|institute|campus|polytechnic)\b/i,
    ],
    category: 'school',
  },
  // Hotel / Accommodation
  {
    patterns: [
      /\b(hotel|motel|hostel|inn|resort|airbnb|bed and breakfast|b&b|suites|lodge|villa|chateau)\b/i,
    ],
    category: 'hotel',
  },
  // Beach
  {
    patterns: [
      /\b(beach|plage|playa|strand|seaside|coastline)\b/i,
    ],
    category: 'beach',
  },
  // Park / Nature
  {
    patterns: [
      /\b(park|garden|jardin|jardim|national park|nature reserve|botanical|arboretum|forest|woods|trail|lakefront|waterfront|greenway)\b/i,
    ],
    category: 'park',
  },
  // Entertainment
  {
    patterns: [
      /\b(cinema|theater|theatre|theatre|concert hall|arena|stadium|bowling|karaoke|escape room|nightclub|club|casino|comedy|comedy club|improv|jazz club|live music)\b/i,
    ],
    category: 'entertainment',
  },
  // Attraction / Landmark
  {
    patterns: [
      /\b(monument|memorial|landmark|tower|palace|castle|fort|ruins|historic|observation deck|viewpoint|lookout)\b/i,
    ],
    category: 'attraction',
  },
  // Bakery
  {
    patterns: [
      /\b(bakery|boulangerie|bäckerei|bagel|patisserie|pâtisserie|pastry|donut shop|dunkin)\b/i,
      /\b(bread|croissant)\b/i,
    ],
    category: 'bakery',
  },
  // Café
  {
    patterns: [
      /\b(café|cafe|coffee|starbucks|blue bottle|third wave|espresso|tea house|bubble tea|boba|tim hortons|dutch bros)\b/i,
    ],
    category: 'cafe',
  },
  // Bar
  {
    patterns: [
      /\b(bar|pub|tavern|brewery|brew|taproom|wine bar|sake bar|cocktail|lounge|speakeasy|distillery)\b/i,
    ],
    category: 'bar',
  },
  // Shop / Retail
  {
    patterns: [
      /\b(market|mart|supermarket|grocery|shop|store|boutique|mall|outlet|department store|target|walmart|costco|trader joe|whole foods|aldi|lidl|ikea|pharmacy)\b/i,
    ],
    category: 'shop',
  },
  // Office / Coworking
  {
    patterns: [
      /\b(office|coworking|co-working|headquarters|hq|workspace|wework|regus)\b/i,
    ],
    category: 'office',
  },
  // Restaurant (catch-all for food words — keep late so more specific ones match first)
  {
    patterns: [
      /\b(restaurant|bistro|brasserie|ristorante|trattoria|osteria|taverna|ramen|sushi|pizza|burger|grill|bbq|barbecue|steakhouse|diner|kitchen|eatery|noodle|dumpling|taqueria|taco|burrito|pho|curry|thai|indian|chinese|japanese|korean|mexican|italian|french|vietnamese|lebanese|mediterranean|seafood|fish and chips|chippie|buffet|bento)\b/i,
      // Chain restaurants
      /\b(mcdonalds|mcdonald's|burger king|wendy's|subway|chipotle|panera|chick-fil-a|kfc|popeyes|taco bell|domino|papa john|little caesar|cinco de mayo)\b/i,
    ],
    category: 'restaurant',
  },
]

/**
 * Infer a category for a place based on its name, address, and list name.
 */
export function inferCategory(
  name: string,
  address?: string,
  listName?: string,
): PlaceCategory {
  const haystack = [name, address || '', listName || ''].join(' ').toLowerCase()

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(haystack)) {
        return rule.category
      }
    }
  }

  return 'other'
}

/**
 * Get category info for a category key.
 */
export function getCategoryInfo(category: PlaceCategory): CategoryInfo {
  return CATEGORY_INFO[category] ?? CATEGORY_INFO.other
}

/**
 * Analyze categories across a list of places.
 * Returns counts sorted by frequency, with percentage.
 */
export interface CategoryCount {
  category: PlaceCategory
  info: CategoryInfo
  count: number
  percentage: number
}

export function analyzeCategories(
  places: Array<{ name: string; address?: string; list?: string }>,
): CategoryCount[] {
  const counts: Partial<Record<PlaceCategory, number>> = {}

  for (const place of places) {
    const cat = inferCategory(place.name, place.address, place.list)
    counts[cat] = (counts[cat] ?? 0) + 1
  }

  const total = places.length || 1
  return (Object.entries(counts) as [PlaceCategory, number][])
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category,
      info: getCategoryInfo(category),
      count,
      percentage: Math.round((count / total) * 100),
    }))
}
