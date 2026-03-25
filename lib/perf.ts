/**
 * Performance profiling utilities
 *
 * Uses the Performance API to mark and measure key operations.
 * Marks are visible in browser DevTools Performance tab.
 */

export function perfMark(name: string): void {
  try {
    performance.mark(name)
  } catch {
    // noop in SSR or unsupported environments
  }
}

export function perfMeasure(name: string, startMark: string, endMark?: string): PerformanceMeasure | null {
  try {
    const measure = performance.measure(name, startMark, endMark)
    if (measure.duration > 100) {
      console.warn(`[perf] ${name} took ${measure.duration.toFixed(1)}ms (>100ms)`)
    }
    return measure
  } catch {
    return null
  }
}

/**
 * Wrap a synchronous function with performance measurement.
 */
export function withPerf<T>(label: string, fn: () => T): T {
  perfMark(`${label}-start`)
  const result = fn()
  perfMark(`${label}-end`)
  perfMeasure(label, `${label}-start`, `${label}-end`)
  return result
}

/**
 * Wrap an async function with performance measurement.
 */
export async function withPerfAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  perfMark(`${label}-start`)
  const result = await fn()
  perfMark(`${label}-end`)
  perfMeasure(label, `${label}-start`, `${label}-end`)
  return result
}
