/**
 * Date utilities for timeline calculations and formatting
 */

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
 * Convert a date to ISO string for database storage
 */
export function toISODateString(date) {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}
