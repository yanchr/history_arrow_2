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
  
  return {
    id: `cluster-${events.map(e => e.id).join('-')}`,
    events,
    position: avgPos,
    count: events.length,
    minYearsAgo,
    maxYearsAgo
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
 * Determine if an event's label should be visible.
 * With priority removed, we show labels for all non-clustered events.
 * Clustering itself handles density at different zoom levels.
 * @param {Object} event - The event object
 * @param {Set} clusteredIds - Set of event IDs that are clustered
 * @returns {boolean} Whether the label should be shown
 */
export function shouldShowLabel(event, clusteredIds) {
  if (clusteredIds && clusteredIds.has(event.id)) {
    return false
  }
  return true
}

/**
 * Calculate zoom bounds so that clustered events become individually visible.
 *
 * Finds the smallest gap between any two distinct yearsAgo values in the
 * cluster and zooms until that gap is at least `minGapPercent` of the view.
 * If every event shares the same date, falls back to a sensible window
 * centred on that date instead of zooming infinitely.
 *
 * @param {Object} cluster - Cluster object with .events[]
 * @param {number} minGapPercent - Target minimum screen % between closest pair (default 8)
 * @returns {Object} { viewStart, viewEnd } in years ago
 */
export function getClusterZoomBounds(cluster, minGapPercent = 8) {
  const yearsAgoValues = cluster.events.map(e => e.yearsAgo)

  // Deduplicate and sort ascending
  const unique = [...new Set(yearsAgoValues)].sort((a, b) => a - b)

  const center = (Math.min(...unique) + Math.max(...unique)) / 2

  if (unique.length <= 1) {
    // All events on the same date — pick a fixed window around that point
    const val = unique[0]
    const halfSpan = Math.max(val * 0.1, 5)
    return {
      viewStart: Math.max(DEFAULT_MIN_YEARS, val - halfSpan),
      viewEnd: Math.min(DEFAULT_MAX_YEARS, val + halfSpan)
    }
  }

  // Find minimum gap between consecutive distinct values
  let minGap = Infinity
  for (let i = 1; i < unique.length; i++) {
    const gap = unique[i] - unique[i - 1]
    if (gap > 0 && gap < minGap) minGap = gap
  }

  // needed_range so that minGap = minGapPercent% of the total range
  const neededRange = minGap / (minGapPercent / 100)

  // Also ensure the full cluster span fits with padding
  const clusterSpan = unique[unique.length - 1] - unique[0]
  const paddedClusterRange = clusterSpan / 0.6 // cluster occupies ~60% of view

  const range = Math.max(neededRange, paddedClusterRange)

  return {
    viewStart: Math.max(DEFAULT_MIN_YEARS, center - range / 2),
    viewEnd: Math.min(DEFAULT_MAX_YEARS, center + range / 2)
  }
}
