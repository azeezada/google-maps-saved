/**
 * Input Sanitization — validate parsed data and prevent XSS from place names.
 *
 * All user-facing strings from parsed data pass through sanitizeString()
 * to strip HTML tags, script injections, and control characters.
 */

const HTML_TAG_RE = /<[^>]*>/g
const SCRIPT_RE = /javascript\s*:/gi
const EVENT_RE = /on\w+\s*=/gi
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

/**
 * Sanitize a user-facing string: strip HTML tags, script injections,
 * event handlers, and control characters.
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .replace(HTML_TAG_RE, '')
    .replace(SCRIPT_RE, '')
    .replace(EVENT_RE, '')
    .replace(CONTROL_CHARS_RE, '')
    .trim()
}

/**
 * Validate and clamp a number to a range.
 */
export function sanitizeNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback
  return Math.max(min, Math.min(max, val))
}

/**
 * Validate latitude value.
 */
export function sanitizeLat(val: unknown): number {
  return sanitizeNumber(val, -90, 90, 0)
}

/**
 * Validate longitude value.
 */
export function sanitizeLng(val: unknown): number {
  return sanitizeNumber(val, -180, 180, 0)
}

/**
 * Validate a rating value (1-5).
 */
export function sanitizeRating(val: unknown): number | undefined {
  if (val == null) return undefined
  const n = sanitizeNumber(val, 1, 5, 0)
  return n >= 1 ? n : undefined
}

/**
 * Validate an ISO date string.
 */
export function sanitizeDate(val: unknown): string | undefined {
  if (!val || typeof val !== 'string') return undefined
  // Basic ISO date validation
  if (!/^\d{4}-\d{2}-\d{2}/.test(val)) return undefined
  const d = new Date(val)
  if (isNaN(d.getTime())) return undefined
  return val
}

/**
 * Sanitize a URL — only allow http/https protocols.
 */
export function sanitizeUrl(val: unknown): string {
  if (!val || typeof val !== 'string') return ''
  const trimmed = val.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return ''
}

/**
 * Sanitize an array of strings.
 */
export function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return tags
    .filter(t => typeof t === 'string')
    .map(t => sanitizeString(t))
    .filter(Boolean)
}
