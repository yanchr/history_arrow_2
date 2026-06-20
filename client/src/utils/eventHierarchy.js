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
 * Validates a sub-event (single date or shorter span) against its parent's span.
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
    if (!childPayload.start_date) {
      return { valid: false, error: 'Start date is required.' }
    }
    const parentStart = parent.start_date
    const parentEnd = parent.end_date

    const childHasEnd = Boolean(childPayload.end_date)

    if (childHasEnd) {
      if (new Date(childPayload.start_date) > new Date(childPayload.end_date)) {
        return { valid: false, error: 'Sub-event end date must be on or after the start date.' }
      }
      if (parentStart && new Date(childPayload.start_date) < new Date(parentStart)) {
        return { valid: false, error: 'Sub-event span must fall within the parent span.' }
      }
      if (parentEnd && new Date(childPayload.end_date) > new Date(parentEnd)) {
        return { valid: false, error: 'Sub-event span must fall within the parent span.' }
      }
    } else {
      const childDate = childPayload.start_date
      if (parentStart && new Date(childDate) < new Date(parentStart)) {
        return { valid: false, error: 'Sub-event date must be within the parent span.' }
      }
      if (parentEnd && new Date(childDate) > new Date(parentEnd)) {
        return { valid: false, error: 'Sub-event date must be within the parent span.' }
      }
    }
    return { valid: true }
  }

  const childStart = childPayload.astronomical_start_year
  if (childStart == null || !Number.isFinite(Number(childStart))) {
    return { valid: false, error: 'Astronomical year is required.' }
  }

  const pStart = Number(parent.astronomical_start_year)
  const pEnd = parent.astronomical_end_year != null ? Number(parent.astronomical_end_year) : pStart
  const parentOlder = Math.max(pStart, pEnd)
  const parentNewer = Math.min(pStart, pEnd)

  if (childPayload.astronomical_end_year != null) {
    const childEnd = Number(childPayload.astronomical_end_year)
    if (!Number.isFinite(childEnd)) {
      return { valid: false, error: 'Astronomical end year is invalid.' }
    }
    const childOlder = Math.max(childStart, childEnd)
    const childNewer = Math.min(childStart, childEnd)
    if (childOlder > parentOlder || childNewer < parentNewer) {
      return { valid: false, error: 'Sub-event span must fall within the parent span (years ago).' }
    }
    return { valid: true }
  }

  if (childStart > parentOlder || childStart < parentNewer) {
    return { valid: false, error: 'Sub-event must fall within the parent span (years ago).' }
  }
  return { valid: true }
}
