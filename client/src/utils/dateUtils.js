/**
 * Date utilities for timeline calculations and formatting
 */

// Astronomical unit multipliers
export const ASTRONOMICAL_UNITS = {
  years: 1,
  thousands: 1000,
  millions: 1000000,
  billions: 1000000000
}

/**
 * Calculate the percentage position of a date on the timeline
 */
export function getTimePosition(date, minDate, maxDate) {
  const dateTime = date.getTime()
  const minTime = minDate.getTime()
  const maxTime = maxDate.getTime()
  const range = maxTime - minTime

  if (range === 0) return 50

  const position = ((dateTime - minTime) / range) * 100
  return Math.max(0, Math.min(100, position))
}

/**
 * Parse astronomical input from form (value + unit) to total years ago
 * @param {number|string} value - The numeric value
 * @param {string} unit - One of: 'years', 'thousands', 'millions', 'billions'
 * @returns {number} Total years ago
 */
export function parseAstronomicalInput(value, unit) {
  const numValue = parseFloat(value)
  if (isNaN(numValue) || numValue <= 0) return null
  
  const multiplier = ASTRONOMICAL_UNITS[unit] || 1
  return Math.round(numValue * multiplier)
}

/**
 * Convert years ago to value and unit for form display
 * @param {number} yearsAgo 
 * @returns {{value: number, unit: string}}
 */
export function yearsAgoToFormValues(yearsAgo) {
  if (yearsAgo >= 1e9) {
    return { value: yearsAgo / 1e9, unit: 'billions' }
  }
  if (yearsAgo >= 1e6) {
    return { value: yearsAgo / 1e6, unit: 'millions' }
  }
  if (yearsAgo >= 1e3) {
    return { value: yearsAgo / 1e3, unit: 'thousands' }
  }
  return { value: yearsAgo, unit: 'years' }
}

/**
 * Format an event's date for display (handles both date types)
 * @param {Object} event - The event object
 * @param {boolean} isEnd - Whether to format the end date
 * @returns {string}
 */
export function formatEventDate(event, isEnd = false) {
  if (event.date_type === 'astronomical') {
    const yearsAgo = isEnd ? event.astronomical_end_year : event.astronomical_start_year
    if (!yearsAgo) return null
    return formatYearsAgo(yearsAgo)
  }
  
  const dateStr = isEnd ? event.end_date : event.start_date
  if (!dateStr) return null
  return formatDisplayDate(dateStr)
}

/**
 * Format years ago as a human-readable string
 * @param {number} yearsAgo 
 * @returns {string}
 */
export function formatYearsAgo(yearsAgo) {
  if (yearsAgo >= 1e9) {
    const value = yearsAgo / 1e9
    const formatted = value % 1 === 0 ? value.toString() : value.toFixed(2)
    return `${formatted} billion years ago`
  }
  if (yearsAgo >= 1e6) {
    const value = yearsAgo / 1e6
    const formatted = value % 1 === 0 ? value.toString() : value.toFixed(1)
    return `${formatted} million years ago`
  }
  if (yearsAgo >= 1e3) {
    const value = yearsAgo / 1e3
    const formatted = value % 1 === 0 ? value.toString() : value.toFixed(1)
    return `${formatted} thousand years ago`
  }
  if (yearsAgo === 1) {
    return '1 year ago'
  }
  return `${Math.round(yearsAgo)} years ago`
}

/**
 * Format years ago as a short label (for timeline ticks)
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
 * Format a date for timeline tick labels
 * Adapts format based on the date range
 */
export function formatTimelineDate(date) {
  const year = date.getFullYear()

  // For ancient dates (before year 0)
  if (year < 0) {
    const absYear = Math.abs(year)
    if (absYear >= 1e9) {
      return `${(absYear / 1e9).toFixed(1)} Ga`
    }
    if (absYear >= 1e6) {
      return `${(absYear / 1e6).toFixed(1)} Ma`
    }
    if (absYear >= 1000) {
      return `${Math.round(absYear / 1000)}k BCE`
    }
    return `${absYear} BCE`
  }

  // For dates before 1000 CE
  if (year < 1000) {
    return `${year} CE`
  }

  // For modern dates
  if (year >= 1900) {
    const month = date.getMonth()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[month]} ${year}`
  }

  return `${year}`
}

/**
 * Format a date for display in tooltips and forms
 */
export function formatDisplayDate(dateString) {
  const date = new Date(dateString)
  const year = date.getFullYear()

  // Handle ancient dates
  if (year < 0) {
    const absYear = Math.abs(year)
    if (absYear >= 1e9) {
      return `${(absYear / 1e9).toFixed(2)} billion years ago`
    }
    if (absYear >= 1e6) {
      return `${(absYear / 1e6).toFixed(1)} million years ago`
    }
    return `${absYear.toLocaleString()} BCE`
  }

  // Modern dates with full formatting
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }

  try {
    return date.toLocaleDateString('en-US', options)
  } catch {
    return dateString
  }
}

/**
 * Parse a date string that might include ancient dates
 * Supports formats like: "4.6bn", "-4600000000", "1879-10-21"
 */
export function parseHistoricalDate(input) {
  if (!input) return null

  const str = String(input).toLowerCase().trim()

  // Handle billion years ago (e.g., "4.6bn", "4.6 billion")
  const bnMatch = str.match(/^(-?)(\d+(?:\.\d+)?)\s*(?:bn|billion|ga)/)
  if (bnMatch) {
    const years = parseFloat(bnMatch[2]) * 1e9
    return new Date(-years * 365.25 * 24 * 60 * 60 * 1000)
  }

  // Handle million years ago (e.g., "65ma", "65 million")
  const maMatch = str.match(/^(-?)(\d+(?:\.\d+)?)\s*(?:ma|million)/)
  if (maMatch) {
    const years = parseFloat(maMatch[2]) * 1e6
    return new Date(-years * 365.25 * 24 * 60 * 60 * 1000)
  }

  // Handle BCE dates
  const bceMatch = str.match(/^(\d+)\s*(?:bce|bc)$/i)
  if (bceMatch) {
    const year = -parseInt(bceMatch[1], 10)
    return new Date(year, 0, 1)
  }

  // Handle CE dates
  const ceMatch = str.match(/^(\d+)\s*(?:ce|ad)$/i)
  if (ceMatch) {
    const year = parseInt(ceMatch[1], 10)
    return new Date(year, 0, 1)
  }

  // Standard ISO date format
  const isoDate = new Date(input)
  if (!isNaN(isoDate.getTime())) {
    return isoDate
  }

  return null
}

/**
 * Validate that start date is before end date
 */
export function validateDateRange(startDate, endDate) {
  if (!startDate) {
    return { valid: false, error: 'Start date is required' }
  }

  const start = new Date(startDate)
  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Invalid start date format' }
  }

  if (endDate) {
    const end = new Date(endDate)
    if (isNaN(end.getTime())) {
      return { valid: false, error: 'Invalid end date format' }
    }
    if (start >= end) {
      return { valid: false, error: 'End date must be after start date' }
    }
  }

  return { valid: true, error: null }
}

/**
 * Validate astronomical year range
 * For astronomical dates, start should be GREATER than end (further in the past)
 */
export function validateAstronomicalRange(startYearsAgo, endYearsAgo) {
  if (!startYearsAgo || startYearsAgo <= 0) {
    return { valid: false, error: 'Start year must be a positive number' }
  }

  if (endYearsAgo !== null && endYearsAgo !== undefined) {
    if (endYearsAgo <= 0) {
      return { valid: false, error: 'End year must be a positive number' }
    }
    if (startYearsAgo <= endYearsAgo) {
      return { valid: false, error: 'Start year must be greater than end year (further in the past)' }
    }
  }

  return { valid: true, error: null }
}

/**
 * Convert a date to ISO string for database storage
 */
export function toISODateString(date) {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}
