/**
 * Logarithmic scale utilities for timeline positioning
 * 
 * These functions handle the conversion between "years ago" and screen positions
 * using a logarithmic scale, which allows smooth navigation from billions of years
 * ago to the present day.
 */

// Default bounds for the timeline
export const DEFAULT_MIN_YEARS = 0.001 // ~now (minimum)
export const DEFAULT_MAX_YEARS = 5e9 // 5 billion years ago (maximum)

/**
 * Convert years ago to a position on the logarithmic scale (0-100)
 * Position 0 = oldest (max years ago)
 * Position 100 = present (min years ago)
 * 
 * @param {number} yearsAgo - Number of years ago
 * @param {number} minYearsAgo - Minimum years ago (closest to present)
 * @param {number} maxYearsAgo - Maximum years ago (furthest from present)
 * @returns {number} Position from 0 to 100
 */
export function yearToLogPosition(yearsAgo, minYearsAgo = DEFAULT_MIN_YEARS, maxYearsAgo = DEFAULT_MAX_YEARS) {
  // Clamp to bounds
  if (yearsAgo <= minYearsAgo) return 100
  if (yearsAgo >= maxYearsAgo) return 0

  const logMin = Math.log10(Math.max(minYearsAgo, 1))
  const logMax = Math.log10(maxYearsAgo)
  const logYear = Math.log10(yearsAgo)

  // Invert so that present (small years) is on the right (100)
  return 100 - ((logYear - logMin) / (logMax - logMin)) * 100
}

/**
 * Convert years ago to a position on a LINEAR scale (0-100)
 * Position 0 = oldest (max years ago)
 * Position 100 = present (min years ago)
 * Does NOT clamp - returns values outside 0-100 for out-of-range events
 * 
 * @param {number} yearsAgo - Number of years ago
 * @param {number} minYearsAgo - Minimum years ago (closest to present)
 * @param {number} maxYearsAgo - Maximum years ago (furthest from present)
 * @returns {number} Position (can be outside 0-100 for out-of-range events)
 */
export function yearToLinearPosition(yearsAgo, minYearsAgo = DEFAULT_MIN_YEARS, maxYearsAgo = DEFAULT_MAX_YEARS) {
  // Linear interpolation without clamping
  // Invert so that present (small years) is on the right (100)
  return 100 - ((yearsAgo - minYearsAgo) / (maxYearsAgo - minYearsAgo)) * 100
}

/**
 * Convert a position on the linear scale (0-100) to years ago
 * 
 * @param {number} position - Position from 0 to 100
 * @param {number} minYearsAgo - Minimum years ago (closest to present)
 * @param {number} maxYearsAgo - Maximum years ago (furthest from present)
 * @returns {number} Years ago
 */
export function linearPositionToYear(position, minYearsAgo = DEFAULT_MIN_YEARS, maxYearsAgo = DEFAULT_MAX_YEARS) {
  // Invert the position calculation
  return minYearsAgo + ((100 - position) / 100) * (maxYearsAgo - minYearsAgo)
}

/**
 * Convert a position on the logarithmic scale (0-100) to years ago
 * 
 * @param {number} position - Position from 0 to 100
 * @param {number} minYearsAgo - Minimum years ago (closest to present)
 * @param {number} maxYearsAgo - Maximum years ago (furthest from present)
 * @returns {number} Years ago
 */
export function logPositionToYear(position, minYearsAgo = DEFAULT_MIN_YEARS, maxYearsAgo = DEFAULT_MAX_YEARS) {
  // Clamp position to valid range
  const clampedPosition = Math.max(0, Math.min(100, position))

  const logMin = Math.log10(Math.max(minYearsAgo, 1))
  const logMax = Math.log10(maxYearsAgo)

  // Invert the position calculation
  const logYear = logMax - (clampedPosition / 100) * (logMax - logMin)
  return Math.pow(10, logYear)
}

/**
 * Generate tick marks for the logarithmic scale
 * Returns positions at powers of 10 and intermediate points
 * 
 * @param {number} minYearsAgo - Minimum years ago
 * @param {number} maxYearsAgo - Maximum years ago
 * @returns {Array<{position: number, yearsAgo: number, label: string}>}
 */
export function getLogTicks(minYearsAgo = DEFAULT_MIN_YEARS, maxYearsAgo = DEFAULT_MAX_YEARS) {
  const ticks = []
  
  // Generate ticks at powers of 10
  const minPower = Math.ceil(Math.log10(Math.max(minYearsAgo, 1)))
  const maxPower = Math.floor(Math.log10(maxYearsAgo))

  for (let power = minPower; power <= maxPower; power++) {
    const yearsAgo = Math.pow(10, power)
    const position = yearToLogPosition(yearsAgo, minYearsAgo, maxYearsAgo)
    
    ticks.push({
      position,
      yearsAgo,
      label: formatYearsAgoShort(yearsAgo)
    })
  }

  return ticks.sort((a, b) => a.position - b.position)
}

/**
 * Generate tick marks for a LINEAR scale
 * Creates evenly spaced ticks across the view range
 * 
 * @param {number} minYearsAgo - Minimum years ago (closest to present)
 * @param {number} maxYearsAgo - Maximum years ago (furthest from present)
 * @param {number} numTicks - Approximate number of ticks to generate (default 5)
 * @returns {Array<{position: number, yearsAgo: number, label: string}>}
 */
export function getLinearTicks(minYearsAgo = DEFAULT_MIN_YEARS, maxYearsAgo = DEFAULT_MAX_YEARS, numTicks = 5) {
  const ticks = []
  const range = maxYearsAgo - minYearsAgo
  
  // Calculate a nice step size
  const roughStep = range / (numTicks - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const normalizedStep = roughStep / magnitude
  
  // Round to a nice number
  let niceStep
  if (normalizedStep <= 1) niceStep = 1
  else if (normalizedStep <= 2) niceStep = 2
  else if (normalizedStep <= 5) niceStep = 5
  else niceStep = 10
  
  niceStep *= magnitude
  
  // Generate ticks at nice intervals
  const startTick = Math.ceil(minYearsAgo / niceStep) * niceStep
  
  for (let yearsAgo = startTick; yearsAgo <= maxYearsAgo; yearsAgo += niceStep) {
    const position = yearToLinearPosition(yearsAgo, minYearsAgo, maxYearsAgo)
    
    if (position >= 0 && position <= 100) {
      ticks.push({
        position,
        yearsAgo,
        label: formatYearsAgoShort(yearsAgo)
      })
    }
  }
  
  return ticks.sort((a, b) => a.position - b.position)
}

/**
 * Generate era markers for the minimap
 * @returns {Array<{name: string, startYearsAgo: number, endYearsAgo: number, color: string}>}
 */
export function getEraMarkers() {
  return [
    { name: 'Hadean', startYearsAgo: 4600000000, endYearsAgo: 4000000000, color: '#8B0000' },
    { name: 'Archean', startYearsAgo: 4000000000, endYearsAgo: 2500000000, color: '#4B0082' },
    { name: 'Proterozoic', startYearsAgo: 2500000000, endYearsAgo: 538000000, color: '#006400' },
    { name: 'Paleozoic', startYearsAgo: 538000000, endYearsAgo: 252000000, color: '#2F4F4F' },
    { name: 'Mesozoic', startYearsAgo: 252000000, endYearsAgo: 66000000, color: '#8B4513' },
    { name: 'Cenozoic', startYearsAgo: 66000000, endYearsAgo: 10000, color: '#DAA520' },
    { name: 'Human History', startYearsAgo: 10000, endYearsAgo: 1, color: '#4169E1' }
  ]
}

/**
 * Format years ago as a short label (for tick marks)
 * @param {number} yearsAgo 
 * @returns {string}
 */
export function formatYearsAgoShort(yearsAgo) {
  if (yearsAgo >= 1e9) {
    const value = yearsAgo / 1e9
    return value % 1 === 0 ? `${value}B` : `${value.toFixed(1)}B`
  }
  if (yearsAgo >= 1e6) {
    const value = yearsAgo / 1e6
    return value % 1 === 0 ? `${value}M` : `${value.toFixed(1)}M`
  }
  if (yearsAgo >= 1e3) {
    const value = yearsAgo / 1e3
    return value % 1 === 0 ? `${value}K` : `${value.toFixed(1)}K`
  }
  return `${Math.round(yearsAgo)}`
}

/**
 * Format years ago as a full readable string
 * @param {number} yearsAgo 
 * @returns {string}
 */
export function formatYearsAgoFull(yearsAgo) {
  if (yearsAgo >= 1e9) {
    const value = yearsAgo / 1e9
    return `${value.toFixed(2)} billion years ago`
  }
  if (yearsAgo >= 1e6) {
    const value = yearsAgo / 1e6
    return `${value.toFixed(1)} million years ago`
  }
  if (yearsAgo >= 1e3) {
    const value = yearsAgo / 1e3
    return `${value.toFixed(1)} thousand years ago`
  }
  if (yearsAgo === 1) {
    return '1 year ago'
  }
  return `${Math.round(yearsAgo)} years ago`
}

/**
 * Convert a calendar date to years ago
 * @param {Date|string} date 
 * @returns {number}
 */
export function dateToYearsAgo(date) {
  const eventDate = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - eventDate.getTime()
  const yearsAgo = diffMs / (365.25 * 24 * 60 * 60 * 1000)
  return Math.max(1, Math.round(yearsAgo))
}

/**
 * Convert years ago to an approximate date
 * Only meaningful for recent history (< 10000 years)
 * @param {number} yearsAgo 
 * @returns {Date}
 */
export function yearsAgoToDate(yearsAgo) {
  const now = new Date()
  const msAgo = yearsAgo * 365.25 * 24 * 60 * 60 * 1000
  return new Date(now.getTime() - msAgo)
}

/**
 * Get the years ago value for an event (handles both date types)
 * @param {Object} event 
 * @returns {number}
 */
export function eventToYearsAgo(event) {
  if (event.date_type === 'astronomical') {
    return event.astronomical_start_year
  }
  return dateToYearsAgo(event.start_date)
}

/**
 * Get the end years ago value for an event (handles both date types)
 * @param {Object} event 
 * @returns {number|null}
 */
export function eventEndToYearsAgo(event) {
  if (event.date_type === 'astronomical') {
    return event.astronomical_end_year || null
  }
  if (event.end_date) {
    return dateToYearsAgo(event.end_date)
  }
  return null
}

/**
 * Calculate the visible range bounds based on view parameters
 * @param {number} viewCenterYears - Center of the view in years ago
 * @param {number} viewSpanYears - Total span of the view in years
 * @returns {{start: number, end: number}}
 */
export function calculateViewBounds(viewCenterYears, viewSpanYears) {
  const halfSpan = viewSpanYears / 2
  return {
    start: Math.max(1, viewCenterYears - halfSpan), // Closer to present
    end: viewCenterYears + halfSpan // Further in past
  }
}

/**
 * Interpolate between two view states for smooth animation
 * @param {Object} from - Starting view state
 * @param {Object} to - Ending view state
 * @param {number} t - Progress (0 to 1)
 * @returns {Object}
 */
export function interpolateView(from, to, t) {
  // Use logarithmic interpolation for years
  const logFromStart = Math.log10(from.start)
  const logFromEnd = Math.log10(from.end)
  const logToStart = Math.log10(to.start)
  const logToEnd = Math.log10(to.end)

  return {
    start: Math.pow(10, logFromStart + (logToStart - logFromStart) * t),
    end: Math.pow(10, logFromEnd + (logToEnd - logFromEnd) * t)
  }
}
