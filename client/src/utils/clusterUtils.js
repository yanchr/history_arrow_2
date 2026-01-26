/**
 * Clustering utilities for adaptive label density on the timeline
 */

import { DEFAULT_MIN_YEARS, DEFAULT_MAX_YEARS } from './logScaleUtils'

/**
 * Detect clusters of overlapping events based on their positions
 * @param {Array} events - Array of positioned events with startPos property
 * @param {number} threshold - Minimum percentage distance between events (default 3%)
 * @returns {Array} Array of cluster objects with events, position, and count
 */
export function detectClusters(events, threshold = 3) {
  if (!events || events.length === 0) return []
  
  // Sort events by position
  const sortedEvents = [...events].sort((a, b) => a.startPos - b.startPos)
  
  const clusters = []
  let currentCluster = [sortedEvents[0]]
  
  for (let i = 1; i < sortedEvents.length; i++) {
    const event = sortedEvents[i]
    const prevEvent = currentCluster[currentCluster.length - 1]
    
    // Calculate distance between events
    const distance = Math.abs(event.startPos - prevEvent.startPos)
    
    if (distance <= threshold) {
      // Events are close enough to be in the same cluster
      currentCluster.push(event)
    } else {
      // Start a new cluster
      if (currentCluster.length > 1) {
        clusters.push(createClusterObject(currentCluster))
      }
      currentCluster = [event]
    }
  }
  
  // Don't forget the last cluster
  if (currentCluster.length > 1) {
    clusters.push(createClusterObject(currentCluster))
  }
  
  return clusters
}

/**
 * Create a cluster object from a group of events
 */
function createClusterObject(events) {
  // Calculate average position for cluster indicator
  const avgPos = events.reduce((sum, e) => sum + e.startPos, 0) / events.length
  
  // Find the time range covered by the cluster
  const yearsAgoValues = events.map(e => e.yearsAgo)
  const minYearsAgo = Math.min(...yearsAgoValues)
  const maxYearsAgo = Math.max(...yearsAgoValues)
  
  // Find the highest priority event in the cluster
  const maxPriority = Math.max(...events.map(e => e.priority || 3))
  
  return {
    id: `cluster-${events.map(e => e.id).join('-')}`,
    events,
    position: avgPos,
    count: events.length,
    minYearsAgo,
    maxYearsAgo,
    maxPriority
  }
}

/**
 * Get IDs of events that are part of any cluster
 * @param {Array} clusters - Array of cluster objects
 * @returns {Set} Set of event IDs that are clustered
 */
export function getClusteredEventIds(clusters) {
  const ids = new Set()
  clusters.forEach(cluster => {
    cluster.events.forEach(event => {
      ids.add(event.id)
    })
  })
  return ids
}

/**
 * Calculate the priority threshold based on zoom level
 * Higher zoom ratio (zoomed out) = higher threshold (fewer labels)
 * Lower zoom ratio (zoomed in) = lower threshold (more labels)
 * 
 * @param {number} viewStart - Start of visible range (years ago, closer to present)
 * @param {number} viewEnd - End of visible range (years ago, further in past)
 * @param {number} totalMin - Minimum possible years ago
 * @param {number} totalMax - Maximum possible years ago
 * @returns {number} Priority threshold (1-5)
 */
export function getPriorityThreshold(
  viewStart,
  viewEnd,
  totalMin = DEFAULT_MIN_YEARS,
  totalMax = DEFAULT_MAX_YEARS
) {
  // Calculate zoom ratio in log space (more appropriate for deep time)
  const viewSpan = Math.log10(viewEnd) - Math.log10(viewStart)
  const totalSpan = Math.log10(totalMax) - Math.log10(totalMin)
  const zoomRatio = viewSpan / totalSpan // 1 = fully zoomed out, 0 = fully zoomed in
  
  // Map zoom ratio to priority threshold
  // At full zoom out (ratio = 1): threshold = 5 (only major events)
  // At full zoom in (ratio = 0): threshold = 1 (all events)
  const threshold = Math.ceil(zoomRatio * 4) + 1
  
  return Math.min(5, Math.max(1, threshold))
}

/**
 * Determine if an event's label should be visible
 * @param {Object} event - The event object with priority
 * @param {number} priorityThreshold - Current priority threshold
 * @param {Set} clusteredIds - Set of event IDs that are clustered
 * @returns {boolean} Whether the label should be shown
 */
export function shouldShowLabel(event, priorityThreshold, clusteredIds) {
  // If the event is in a cluster, hide the label (cluster indicator will show instead)
  if (clusteredIds && clusteredIds.has(event.id)) {
    return false
  }
  
  // Show label if event priority meets or exceeds the threshold
  const eventPriority = event.priority || 3
  return eventPriority >= priorityThreshold
}

/**
 * Calculate zoom bounds to show a specific cluster
 * @param {Object} cluster - The cluster to zoom into
 * @param {number} padding - Padding factor (default 1.5 = 50% padding on each side)
 * @returns {Object} { viewStart, viewEnd } in years ago
 */
export function getClusterZoomBounds(cluster, padding = 1.5) {
  const { minYearsAgo, maxYearsAgo } = cluster
  
  // Calculate the span in log space
  const logMin = Math.log10(minYearsAgo)
  const logMax = Math.log10(maxYearsAgo)
  const logSpan = logMax - logMin
  
  // Add padding in log space
  const paddedLogMin = logMin - logSpan * (padding - 1)
  const paddedLogMax = logMax + logSpan * (padding - 1)
  
  // Ensure minimum span for single events
  const minSpan = 0.5 // At least half an order of magnitude
  const actualSpan = paddedLogMax - paddedLogMin
  
  let finalLogMin = paddedLogMin
  let finalLogMax = paddedLogMax
  
  if (actualSpan < minSpan) {
    const center = (paddedLogMin + paddedLogMax) / 2
    finalLogMin = center - minSpan / 2
    finalLogMax = center + minSpan / 2
  }
  
  return {
    viewStart: Math.max(DEFAULT_MIN_YEARS, Math.pow(10, finalLogMin)),
    viewEnd: Math.min(DEFAULT_MAX_YEARS, Math.pow(10, finalLogMax))
  }
}
