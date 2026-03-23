import { eventToYearsAgo, eventEndToYearsAgo } from './logScaleUtils'

/**
 * Top-level events are rows without a parent_id (shown on the main arrow by default).
 */
export function isTopLevelEvent(event) {
  return !event?.parent_id
}

/**
 * Events to pass into HistoryArrow: top-level rows matching the caller's filters,
 * plus all sub-events whose parent is in that top-level set (sub-events are not
 * filtered by search so hover/detail still work when the parent matches).
 */
export function getEventsForTimeline(allEvents, topLevelFiltered) {
  if (!Array.isArray(allEvents) || !Array.isArray(topLevelFiltered)) {
    return []
  }
  const parentIds = new Set(topLevelFiltered.filter(isTopLevelEvent).map((e) => e.id))
  const subs = allEvents.filter((e) => e.parent_id && parentIds.has(e.parent_id))
  return [...topLevelFiltered, ...subs]
}

export function getSubEventsForParent(allEvents, parentId) {
  if (!parentId || !Array.isArray(allEvents)) return []
  return allEvents
    .filter((e) => e.parent_id === parentId)
    .sort((a, b) => eventToYearsAgo(b) - eventToYearsAgo(a))
}

export function isParentSpan(event) {
  if (!event) return false
  if (event.date_type === 'astronomical') {
    return !!event.astronomical_end_year
  }
  return !!event.end_date
}

/**
 * Validates a sub-event payload (point-in-time only) against its parent span.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSubEventDates(parent, childPayload) {
  if (!parent || !isParentSpan(parent)) {
    return { valid: false, error: 'Sub-events require a parent time span.' }
  }
  if (childPayload.date_type !== parent.date_type) {
    return { valid: false, error: 'Sub-event must use the same date type as the parent.' }
  }

  if (childPayload.date_type === 'date') {
    if (childPayload.end_date) {
      return { valid: false, error: 'Sub-events must be a single date (no end date).' }
    }
    if (!childPayload.start_date) {
      return { valid: false, error: 'Start date is required.' }
    }
    const parentStart = parent.start_date
    const parentEnd = parent.end_date
    const childDate = childPayload.start_date
    if (parentStart && new Date(childDate) < new Date(parentStart)) {
      return { valid: false, error: 'Sub-event date must be within the parent span.' }
    }
    if (parentEnd && new Date(childDate) > new Date(parentEnd)) {
      return { valid: false, error: 'Sub-event date must be within the parent span.' }
    }
    return { valid: true }
  }

  if (childPayload.astronomical_end_year) {
    return { valid: false, error: 'Sub-events must be a single astronomical moment (no end year).' }
  }
  const childStart = childPayload.astronomical_start_year
  if (childStart == null || !Number.isFinite(Number(childStart))) {
    return { valid: false, error: 'Astronomical year is required.' }
  }
  const pStart = parent.astronomical_start_year
  const pEnd = parent.astronomical_end_year
  const spanEnd = pEnd ?? pStart
  const older = Math.max(pStart, spanEnd)
  const newer = Math.min(pStart, spanEnd)
  if (childStart > older || childStart < newer) {
    return { valid: false, error: 'Sub-event must fall within the parent span (years ago).' }
  }
  return { valid: true }
}
